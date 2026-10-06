declare module 'snowball-stemmers' {
  const factory: { newStemmer(language: string): { stem(word: string): string } };
  export default factory;
}
