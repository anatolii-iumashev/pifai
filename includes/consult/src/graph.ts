import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ConsultationJob } from './types.js';
import { validateJob } from './types.js';
import type { DialogueStore, HistoryMessage } from './storage.js';
import type { TelegramClient } from './telegram.js';
import type { WikiPack } from './wiki.js';
import { wikiVersion } from './wiki.js';
import { navigationInstructions, wikiTools, wikiToolNames, type LoadedSource, type WikiSources } from './tools.js';
import { cleanModelText, crisisResponse, isCrisis, unavailableResponse } from './safety.js';
import { composeQuotes } from './quotes.js';

export type Route = 'command' | 'crisis' | 'consult';
export type Command = 'start' | 'help' | 'clear';
export type Outcome = 'delivered' | 'already-attempted' | 'delivery-uncertain' | 'invalid' | 'model-failed';

export interface Dependencies {
  store: DialogueStore;
  model: BaseChatModel;
  telegram: TelegramClient;
  /** Support skill content: the source of consultation rules, not code. */
  skill: string;
  wiki: WikiPack;
  log?: (event: Record<string, string | number | undefined>) => void;
}

export const greetingResponse = 'Привет! Я ПиФ, ИИ-помощник по психологии и философии. Могу выслушать и предложить материалы из базы знаний. Расскажи, что тебя волнует? Я не заменяю психолога или врача.';
export const helpResponse = 'Напиши вопрос или расскажи о ситуации. /start — начать заново, /help — справка, /clear — удалить историю этого чата. Я ИИ-помощник и не заменяю специалиста.';
export const clearResponse = 'История этого чата очищена. Можем начать заново.';
export const ackMessage = 'Давайте подумаем…';

export function commandOf(text: string): Command | undefined {
  return text.match(/^\/(start|help|clear)(?:@\w+)?(?:\s|$)/i)?.[1]?.toLowerCase() as Command | undefined;
}

const State = Annotation.Root({
  job: Annotation<ConsultationJob | null>({ reducer: (_, b) => b, default: () => null }),
  history: Annotation<HistoryMessage[]>({ reducer: (_, b) => b, default: () => [] }),
  route: Annotation<Route>({ reducer: (_, b) => b, default: () => 'consult' }),
  command: Annotation<Command | null>({ reducer: (_, b) => b, default: () => null }),
  response: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  ackMessageId: Annotation<number | null>({ reducer: (_, b) => b, default: () => null }),
  claimed: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  outcome: Annotation<Outcome | ''>({ reducer: (_, b) => b, default: () => '' }),
});
type State = typeof State.State;

const commandResponses: Record<Command, string> = {
  start: greetingResponse,
  help: helpResponse,
  clear: clearResponse,
};

function textOf(message: BaseMessage | undefined): string {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((block) => typeof block === 'string' ? block : (block as { text?: string }).text ?? '').join('\n');
  }
  return String(content);
}

export function buildConsultGraph(deps: Dependencies) {
  const sources: WikiSources = { loaded: [] };
  const { tools, functions: toolFunctions } = wikiTools(sources, deps.wiki);
  const bound = deps.model.bindTools?.(tools) ?? deps.model;

  const validate = async (state: State): Promise<Partial<State>> => {
    try {
      return { job: validateJob(state.job) };
    } catch (error) {
      deps.log?.({ event: 'invalid_job', message: String(error) });
      return { outcome: 'invalid', response: '' };
    }
  };

  const loadHistory = async (state: State): Promise<Partial<State>> =>
    ({ history: await deps.store.history(state.job!.chatId) });

  const route = (state: State): Partial<State> => {
    const command = commandOf(state.job!.text);
    if (command) return { route: 'command', command };
    if (isCrisis(state.job!.text)) return { route: 'crisis' };
    return { route: 'consult' };
  };

  const answerCommand = async (state: State): Promise<Partial<State>> => {
    const command = state.command!;
    // /start and /clear reset only the current private chat's history.
    if (command === 'start' || command === 'clear') await deps.store.clear(state.job!.chatId);
    return { response: commandResponses[command] };
  };

  // Crisis signals are checked before search and the LLM; the answer carries no
  // geographically specific number until contacts are approved by hand.
  const answerCrisis = async (): Promise<Partial<State>> => ({ response: crisisResponse });

  // Life-sign: a short comment right after the update is claimed, replaced by
  // the answer (or the failure message) once the graph has it.
  const sendAck = async (state: State): Promise<Partial<State>> => {
    try {
      const messageId = await deps.telegram.ack(state.job!.chatId, ackMessage);
      return { ackMessageId: messageId };
    } catch (error) {
      deps.log?.({ event: 'ack_failed', message: String(error) });
      return { ackMessageId: null };
    }
  };

  const agent = async (state: State): Promise<Partial<State>> => {
    const version = wikiVersion();
    const system = new SystemMessage(deps.skill + navigationInstructions(version));
    const input = state.messages.length ? state.messages
      : [
          system,
          ...state.history.map((message) => message.role === 'user'
            ? new HumanMessage(message.content)
            : new AIMessage(message.content)),
          new HumanMessage(state.job!.text),
        ];
    try {
      const reply = await bound.invoke(input);
      return { messages: [reply] };
    } catch {
      deps.log?.({ event: 'model_failed', knowledgeVersion: version });
      return { response: unavailableResponse, outcome: 'model-failed' };
    }
  };

  const executeWikiTools = async (state: State): Promise<Partial<State>> => {
    const last = state.messages.at(-1) as AIMessage;
    const results = await Promise.all((last.tool_calls ?? []).map(async (call) => {
      let content: string;
      try {
        const executable = toolFunctions[call.name];
        if (!executable) content = `Неизвестный инструмент: ${call.name}. Доступны: ${wikiToolNames.join(', ')}.`;
        else content = String(await executable(call.args as never));
      } catch (error) {
        content = `Инструмент не сработал: ${error instanceof Error ? error.message : String(error)}`;
      }
      return new ToolMessage({ content, name: call.name, tool_call_id: call.id ?? '' });
    }));
    return { messages: results };
  };

  const assemble = async (state: State): Promise<Partial<State>> => {
    if (state.outcome === 'model-failed') return {}; // response already the neutral one
    const last = state.messages.at(-1);
    const text = cleanModelText(textOf(last));
    const response = text || unavailableResponse;
    const unique = [...new Map(sources.loaded.map((source) => [source.url, source])).values()];
    let final = response;
    if (response !== unavailableResponse) {
      // The model may deliver quotes in its own section; they are validated against
      // the wiki pack and topped up from retrieval to 2–4 ("мысли великих на тему").
      const composed = composeQuotes(deps.wiki, response, `${state.job!.text} ${unique.map((source) => source.title).join(' ')}`);
      final = composed.answer;
      if (composed.quotes) final += `\n\n${composed.quotes}`;
    }
    if (unique.length && response !== unavailableResponse) {
      final += '\n\n## Материалы базы знаний\n' + unique.map((source) => `- [${source.title}](${source.url})`).join('\n');
    }
    const ai = state.messages.filter((message) => message instanceof AIMessage).at(-1) as AIMessage | undefined;
    deps.log?.({
      event: 'model_completed',
      knowledgeVersion: wikiVersion(),
      model: (ai?.response_metadata?.model_name as string | undefined) ?? (ai?.response_metadata?.model as string | undefined) ?? 'unknown',
      promptTokens: ai?.usage_metadata?.input_tokens,
      completionTokens: ai?.usage_metadata?.output_tokens,
    });
    return { response: final };
  };

  const saveHistory = async (state: State): Promise<Partial<State>> => {
    // Commands and crisis answers do not enter the chat history.
    if (state.route !== 'consult' || state.response === unavailableResponse) return {};
    try {
      await deps.store.saveHistory(state.job!.chatId, state.job!.text, state.response);
    } catch (error) {
      deps.log?.({ event: 'history_save_failed', message: String(error) });
    }
    return {};
  };

  const claimDelivery = async (state: State): Promise<Partial<State>> => {
    // The delivery marker is written before sending; an existing object means
    // a retry already owns (or owned) this update, so no second answer is sent.
    const claimed = await deps.store.claimDelivery(state.job!.updateId);
    return claimed ? { claimed: true } : { claimed: false, outcome: 'already-attempted' };
  };

  const send = async (state: State): Promise<Partial<State>> => {
    try {
      await deps.telegram.send(state.job!.chatId, state.response, state.ackMessageId ?? undefined);
      return { outcome: 'delivered' };
    } catch {
      // The request may have reached Telegram. Replaying it could send a second message.
      deps.log?.({ event: 'delivery_uncertain', updateId: state.job!.updateId });
      return { outcome: 'delivery-uncertain' };
    }
  };

  const hasPendingToolCalls = (state: State): boolean => {
    if (state.outcome === 'model-failed') return false;
    const last = state.messages.at(-1);
    return last instanceof AIMessage && Boolean(last.tool_calls?.length);
  };

  return new StateGraph(State)
    .addNode('validate', validate)
    .addNode('load_history', loadHistory)
    .addNode('plan_route', route)
    .addNode('answer_command', answerCommand)
    .addNode('answer_crisis', answerCrisis)
    .addNode('claim_delivery', claimDelivery)
    .addNode('ack', sendAck)
    .addNode('agent', agent)
    .addNode('wiki_tools', executeWikiTools)
    .addNode('assemble', assemble)
    .addNode('save_history', saveHistory)
    .addNode('send', send)
    .addEdge(START, 'validate')
    .addConditionalEdges('validate', (state) => state.outcome === 'invalid' ? END : 'load_history', [END, 'load_history'])
    .addEdge('load_history', 'plan_route')
    .addConditionalEdges('plan_route', (state) => state.route, {
      command: 'answer_command',
      crisis: 'answer_crisis',
      consult: 'claim_delivery',
    })
    .addEdge('answer_command', 'claim_delivery')
    .addEdge('answer_crisis', 'claim_delivery')
    .addConditionalEdges('claim_delivery', (state) => {
      if (!state.claimed) return END;
      // Only consultations get the thinking comment; commands and crisis answers are instant.
      return state.route === 'consult' ? 'ack' : 'send';
    }, [END, 'ack', 'send'])
    .addEdge('ack', 'agent')
    .addConditionalEdges('agent', (state) => hasPendingToolCalls(state) ? 'wiki_tools' : 'assemble', ['wiki_tools', 'assemble'])
    .addEdge('wiki_tools', 'agent')
    .addEdge('assemble', 'save_history')
    .addEdge('save_history', 'send')
    .addEdge('send', END)
    .compile();
}

export async function processConsultation(input: unknown, deps: Dependencies): Promise<{ status: string }> {
  const graph = buildConsultGraph(deps);
  const result = await graph.invoke({ job: input as ConsultationJob | null });
  if (!result.outcome) throw new Error('Consultation ended without an outcome');
  return { status: result.outcome };
}
