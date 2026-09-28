export const QUOTE_TOPICS = [
  'self-knowledge',
  'memento-mori',
  'freedom-slavery',
  'faith-soul-god',
  'good-deeds-service',
  'fate-acceptance',
  'thoughts-reality',
  'wisdom-knowledge',
  'hatred-anger-forgiveness',
  'childhood-innocence',
] as const;

export type QuoteTopic = (typeof QUOTE_TOPICS)[number];
