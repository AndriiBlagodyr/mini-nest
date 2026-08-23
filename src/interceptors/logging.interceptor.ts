import type { IncomingMessage } from 'node:http';

export interface Interceptor {
  before(req: IncomingMessage): void | Promise<void>;
  after(req: IncomingMessage, result: unknown, durationMs: number): void | Promise<void>;
}

export class LoggingInterceptor implements Interceptor {
  private logger: (msg: string) => void;

  constructor(logger?: (msg: string) => void) {
    this.logger = logger ?? console.log;
  }

  before(): void {}

  after(req: IncomingMessage, _result: unknown, durationMs: number): void {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    this.logger(`${method} ${url} — ${durationMs.toFixed(1)} ms`);
  }
}
