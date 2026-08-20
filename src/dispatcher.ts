import 'reflect-metadata';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { URL } from 'node:url';

import { Container } from './container.js';
import { type ResolvedRoute, Router } from './router.js';
import { validate } from './pipes/validation.pipe.js';

export class Dispatcher {
  private readonly server: Server;
  private readonly router: Router;
  private readonly container: Container;

  constructor(container: Container) {
    this.container = container;
    this.router = new Router(container);
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  registerController(controller: new (...args: never[]) => unknown): this {
    this.router.registerController(controller);
    return this;
  }

  listen(port: number): Promise<Server> {
    return new Promise((resolve) => {
      this.server.listen(port, () => resolve(this.server));
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  getServer(): Server {
    return this.server;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const method = req.method ?? 'GET';
      const pathname = url.pathname;

      const matched = this.router.match(method, pathname);
      if (!matched) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
      }

      const { route, params } = matched;
      const query = Object.fromEntries(url.searchParams.entries());
      const body = method === 'POST' || method === 'PUT' || method === 'PATCH'
        ? await this.parseBody(req)
        : undefined;

      const args = await this.buildArgs(route, params, query, body);

      const controllerInstance = this.container.resolve(
        route.controllerToken as new (...args: never[]) => Record<string, (...a: unknown[]) => unknown>,
      );
      const result = await controllerInstance[route.handlerName](...args);

      const statusCode = method === 'POST' ? 201 : 200;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: err.errors }));
        return;
      }
      if (err instanceof BadRequestError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private async buildArgs(
    route: ResolvedRoute,
    params: Record<string, string>,
    query: Record<string, string>,
    body: unknown,
  ): Promise<unknown[]> {
    const args: unknown[] = [];

    for (const meta of route.paramsMetadata) {
      switch (meta.type) {
        case 'param':
          args[meta.index] = meta.name ? params[meta.name] : params;
          break;
        case 'query':
          args[meta.index] = meta.name ? query[meta.name] : query;
          break;
        case 'body': {
          const controllerCtor = route.controllerToken as new (...a: never[]) => unknown;
          const paramTypes: (new (...a: never[]) => unknown)[] =
            Reflect.getMetadata('design:paramtypes', controllerCtor.prototype, route.handlerName) ?? [];
          const dtoClass = paramTypes[meta.index] as (new (...a: unknown[]) => object) | undefined;
          if (dtoClass && dtoClass !== Object) {
            const validated = await validate(dtoClass, body);
            args[meta.index] = validated;
          } else {
            args[meta.index] = body;
          }
          break;
        }
      }
    }

    return args;
  }

  private parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new BadRequestError('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}

export class ValidationError extends Error {
  constructor(public readonly errors: { field: string; constraints: string[] }[]) {
    super('Validation failed');
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}
