declare module 'hono' {
  type HonoHandler = (c: any) => any;

  export class Hono<T = any> {
    constructor();
    get(path: string, handler: HonoHandler): this;
    post(path: string, handler: HonoHandler): this;
    all(path: string, handler: HonoHandler): this;
  }
}
