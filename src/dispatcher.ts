import 'reflect-metadata';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { URL } from 'node:url';

import { Container } from './container.js';
import { requestContext, createRequestStore } from './context/request-context.js';
import { type ResolvedRoute, Router } from './router.js';
import { handleException, ForbiddenError, BadRequestError } from './filters/exception.filter.js';
import type { Guard } from './guards/auth.guard.js';
import type { Interceptor } from './interceptors/logging.interceptor.js';
import type { ZodSchema } from './pipes/zod-validation.pipe.js';
import { zodValidate } from './pipes/zod-validation.pipe.js';

export interface MiddlewareFn {
  (req: IncomingMessage, res: ServerResponse): void | Promise<void>;
}

export interface LifecycleHooks {
  onMiddleware?: () => void;
  onGuard?: () => void;
  onInterceptorBefore?: () => void;
  onPipe?: () => void;
  onHandler?: () => void;
  onInterceptorAfter?: () => void;
}

export class Dispatcher {
  private readonly server: Server;
  private readonly router: Router;
  private readonly container: Container;
  private readonly middlewares: MiddlewareFn[] = [];
  private readonly guards: Guard[] = [];
  private readonly interceptors: Interceptor[] = [];
  private readonly pipeSchemas = new Map<string, ZodSchema>();
  private hooks: LifecycleHooks = {};

  constructor(container: Container) {
    this.container = container;
    this.router = new Router(container);
    this.server = createServer((req, res) => {
      const store = createRequestStore(
        req.headers['x-request-id'] as string | undefined,
      );
      requestContext.run(store, () => this.handleRequest(req, res, store.requestId));
    });
  }

  registerController(controller: new (...args: never[]) => unknown): this {
    this.router.registerController(controller);
    return this;
  }

  useMiddleware(fn: MiddlewareFn): this {
    this.middlewares.push(fn);
    return this;
  }

  useGuard(guard: Guard): this {
    this.guards.push(guard);
    return this;
  }

  useInterceptor(interceptor: Interceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  usePipe(routeKey: string, schema: ZodSchema): this {
    this.pipeSchemas.set(routeKey, schema);
    return this;
  }

  setHooks(hooks: LifecycleHooks): this {
    this.hooks = hooks;
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

  private async handleRequest(req: IncomingMessage, res: ServerResponse, requestId: string): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const method = req.method ?? 'GET';
      const pathname = url.pathname;

      // Middleware
      this.hooks.onMiddleware?.();
      for (const mw of this.middlewares) {
        await mw(req, res);
      }

      const matched = this.router.match(method, pathname);
      if (!matched) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'X-Request-Id': requestId });
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
      }

      const { route, params } = matched;
      const query = Object.fromEntries(url.searchParams.entries());

      // Guard
      this.hooks.onGuard?.();
      for (const guard of this.guards) {
        const allowed = await guard.canActivate(req);
        if (!allowed) {
          throw new ForbiddenError();
        }
      }

      // Interceptor: before
      this.hooks.onInterceptorBefore?.();
      const startTime = performance.now();
      for (const interceptor of this.interceptors) {
        await interceptor.before(req);
      }

      // Parse body
      const body = method === 'POST' || method === 'PUT' || method === 'PATCH'
        ? await this.parseBody(req)
        : undefined;

      // Pipe (Zod validation)
      this.hooks.onPipe?.();
      const args = this.buildArgs(route, params, query, body);

      // Handler
      this.hooks.onHandler?.();
      const controllerInstance = this.container.resolve(
        route.controllerToken as new (...args: never[]) => Record<string, (...a: unknown[]) => unknown>,
      );
      const result = await controllerInstance[route.handlerName](...args);

      // Interceptor: after
      this.hooks.onInterceptorAfter?.();
      const durationMs = performance.now() - startTime;
      for (const interceptor of this.interceptors) {
        await interceptor.after(req, result, durationMs);
      }

      const statusCode = method === 'POST' ? 201 : 200;
      res.writeHead(statusCode, { 'Content-Type': 'application/json', 'X-Request-Id': requestId });
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      res.setHeader('X-Request-Id', requestId);
      handleException(err, res);
    }
  }

  private buildArgs(
    route: ResolvedRoute,
    params: Record<string, string>,
    query: Record<string, string>,
    body: unknown,
  ): unknown[] {
    const args: unknown[] = [];
    const routeKey = `${route.handlerName}`;
    const schema = this.pipeSchemas.get(routeKey);

    for (const meta of route.paramsMetadata) {
      switch (meta.type) {
        case 'param':
          args[meta.index] = meta.name ? params[meta.name] : params;
          break;
        case 'query':
          args[meta.index] = meta.name ? query[meta.name] : query;
          break;
        case 'body': {
          if (schema) {
            args[meta.index] = zodValidate(schema, body);
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
