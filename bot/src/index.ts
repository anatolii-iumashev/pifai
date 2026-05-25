import { createBot } from './bot';
import { initLLM } from './llm';
import { initSessionStore } from './session';
import { KNOWLEDGE_BASE } from './knowledge';
import { SYSTEM_PROMPT } from './prompts';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  KNOWLEDGE_VERSION?: string;
  SESSIONS: KVNamespace;
}

let botInstance: ReturnType<typeof createBot> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET / — redirect to landing
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/ui')) {
      return new Response(LANDING_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // GET /health — health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        hasSecrets: !!env.TELEGRAM_BOT_TOKEN && !!env.GROQ_API_KEY,
        knowledgeVersion: env.KNOWLEDGE_VERSION || '1.0.0',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /webhook — Telegram updates
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        // Lazy init bot
        if (!botInstance) {
          if (!env.TELEGRAM_BOT_TOKEN || !env.GROQ_API_KEY) {
            return new Response('Missing secrets', { status: 500 });
          }
          const llm = initLLM({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'llama-3.1-8b-instant' });
          const sessions = initSessionStore(env);
          botInstance = createBot({
            token: env.TELEGRAM_BOT_TOKEN,
            llm,
            sessions,
            systemPrompt: SYSTEM_PROMPT(KNOWLEDGE_BASE),
          });
        }

        // Parse update body
        const update = await request.json();
        await botInstance.handleUpdate(update);
        return new Response('ok', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('ok', { status: 200 }); // always 200 to stop retries
      }
    }

    // 404
    return new Response('Not found', { status: 404 });
  },
};

const LANDING_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ПиФ Ai — Психология и Философия</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap');
  body{
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    height:100vh;overflow:hidden;
    background:linear-gradient(180deg,#0b0e1a 0%,#1a1f2e 40%,#2a2f42 100%);
    color:#e8e8e8;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    -webkit-font-smoothing:antialiased;
  }
  #rain{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}
  .mist{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;background:radial-gradient(ellipse at 50% 80%,rgba(180,190,220,0.03) 0%,transparent 70%)}
  .content{position:relative;z-index:2;text-align:center;padding:2rem;max-width:480px}
  h1{font-size:5rem;font-weight:200;letter-spacing:.2em;margin-bottom:.75rem;color:rgba(212,212,232,.9);text-shadow:0 0 80px rgba(180,190,220,.08)}
  .subtitle{font-size:1.1rem;font-weight:300;color:rgba(154,154,176,.8);margin-bottom:.25rem;letter-spacing:.08em}
  .tagline{font-size:.85rem;font-weight:300;color:rgba(120,120,145,.6);margin-bottom:3rem;letter-spacing:.04em}
  .links{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
  .links a{
    display:inline-flex;align-items:center;gap:.6rem;
    padding:.7rem 1.75rem;
    border:1px solid rgba(255,255,255,.08);border-radius:100px;
    background:rgba(255,255,255,.03);
    color:rgba(200,200,220,.8);text-decoration:none;
    font-size:.9rem;font-weight:400;
    transition:all .4s ease;
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  }
  .links a:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);color:#fff;transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.3)}
  .links a svg{width:18px;height:18px;opacity:.7}
  .links a:hover svg{opacity:1}
  .footer{position:fixed;bottom:2rem;z-index:2;font-size:.7rem;color:rgba(120,120,145,.35);letter-spacing:.05em}
  @media(max-width:480px){h1{font-size:3rem;letter-spacing:.15em}.links{flex-direction:column;align-items:center}.links a{width:100%;justify-content:center}}
</style>
</head>
<body>
<canvas id="rain"></canvas>
<div class="mist"></div>
<div class="content">
  <h1>ΠиФ Ai</h1>
  <p class="subtitle">Психология и Философия</p>
  <p class="tagline">эмпатичный ассистент на основе 7 психологических школ</p>
  <div class="links">
    <a href="https://t.me/pif_bbot" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.587.192l-8.533 7.723h-.002l-.003.002-.315 3.13c.456 0 .663-.21.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.22c.309-1.239-.473-1.8-1.282-1.434z"/></svg>
      Telegram бот
    </a>
    <a href="https://anatolii-iumashev.github.io/pifai/" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
      База знаний
    </a>
  </div>
</div>
<div class="footer">ΠиФ 2026</div>
<script>
const c=document.getElementById('rain'),x=c.getContext('2d');let W,H;
function r(){W=c.width=innerWidth;H=c.height=innerHeight}r();
addEventListener('resize',r);
const D=Math.min(250,Math.floor(W*H/4000));
const dr=Array.from({length:D},()=>({x:Math.random()*W,y:Math.random()*-H,speed:3+Math.random()*8,len:12+Math.random()*24,op:.15+Math.random()*.35,w:.5+Math.random()*1.2}));
function d(){x.clearRect(0,0,W,H);for(const p of dr){p.y+=p.speed;if(p.y-p.len>H){p.y=-p.len-100*Math.random();p.x=Math.random()*W}x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-p.speed*.35,p.y-p.len);x.strokeStyle='rgba(200,210,240,'+p.op+')';x.lineWidth=p.w;x.lineCap='round';x.stroke()}requestAnimationFrame(d)}
d();
</script>
</body>
</html>`;
