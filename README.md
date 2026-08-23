# mini-nest

A minimal IoC container and HTTP framework inspired by NestJS — all 3 parts (IoC, routing, full request lifecycle).

## Run locally

```bash
npm install
npm test
npm run build
```

## Run in Docker

```bash
docker compose run --rm api npm test
```

## How it works

When TypeScript compiles with `experimentalDecorators` and `emitDecoratorMetadata`, the compiler emits calls to `Reflect.defineMetadata('design:paramtypes', [...], Target)` for every decorated class constructor. Those entries are the runtime constructor parameter types (classes become constructor functions; interfaces and type aliases erase to `Object`). The container reads that metadata via `Reflect.getMetadata('design:paramtypes', Target)` and recursively instantiates each dependency. Without `emitDecoratorMetadata`, no `design:paramtypes` metadata exists — even if a class has `@Injectable()`, the container cannot discover constructor dependencies automatically. For erased types (interfaces, primitives injected as abstractions), the `@Inject(token)` parameter decorator stores an explicit token in metadata so the container resolves by `Symbol` or string instead of by constructor type.

## How parameter decorators know where to inject values

A parameter decorator receives three arguments: `(target, propertyKey, parameterIndex)`. `target` is the class prototype (for instance methods) or the constructor (for constructor params), `propertyKey` is the method name, and `parameterIndex` is the zero-based position of the parameter.

When you write `@Param('id') id: string`, the decorator stores `{ index: 0, type: 'param', name: 'id' }` in metadata keyed by the method name. It does NOT extract any value — it only records *where* the value should come from.

Later, when the dispatcher handles a request, it reads that metadata array, iterates over it, and builds the arguments list: for each entry it pulls the value from the appropriate source (URL params, query string, or parsed body) and places it at the correct array index. The handler is then called with that constructed arguments array.

## Request lifecycle

Every HTTP request passes through the following stages in order:

```
  Request
    │
    ▼
┌──────────────┐
│  Middleware   │  Runs first. Cross-cutting concerns (logging, CORS, etc.)
└──────┬───────┘
       ▼
┌──────────────┐
│    Guard      │  Decides "allow or deny". Returns boolean.
│              │  false → 403, handler never runs.
└──────┬───────┘
       ▼
┌──────────────┐
│ Interceptor  │  before(): runs before handler (start timer, etc.)
│   (before)   │
└──────┬───────┘
       ▼
┌──────────────┐
│     Pipe      │  Validates/transforms arguments (Zod schema).
│              │  Invalid → throws ValidationError → 400.
└──────┬───────┘
       ▼
┌──────────────┐
│   Handler     │  Your controller method. Business logic lives here.
└──────┬───────┘
       ▼
┌──────────────┐
│ Interceptor  │  after(): runs after handler (measure duration, transform result)
│   (after)    │
└──────┬───────┘
       ▼
┌──────────────┐
│  Exception   │  Catches ANY error from the chain above.
│   Filter     │  Maps to proper HTTP status (404, 400, 500).
└──────┬───────┘
       ▼
  Response
```

Guard vs Interceptor in one sentence: a guard answers "allow or deny" before everything and cannot modify the response; an interceptor wraps the handler call and sees both input and output.

## Why AsyncLocalStorage, not a global variable

While one request awaits an async operation (DB query, HTTP call), the event loop processes other incoming requests. If you store `requestId` in a module-level variable, a concurrent request overwrites it before the first request reads it back — you get the wrong ID in your logs.

`AsyncLocalStorage` from `node:async_hooks` solves this by maintaining a separate store per async execution chain. When you call `als.run(store, callback)`, every function called inside that callback — no matter how deep, no matter how many awaits — sees the same store via `als.getStore()`. Two parallel requests each get their own isolated store.

This is the same pattern used in production for OpenTelemetry tracing, request-scoped logging, and transaction management.

## Project layout

| Path | Purpose |
|------|---------|
| `src/decorators/injectable.ts` | `@Injectable()` class decorator |
| `src/decorators/inject.ts` | `@Inject(token)` parameter decorator |
| `src/decorators/controller.ts` | `@Controller(prefix)` class decorator |
| `src/decorators/methods.ts` | `@Get` / `@Post` method decorators |
| `src/decorators/params.ts` | `@Body`, `@Param`, `@Query` parameter decorators |
| `src/container.ts` | IoC dependency resolver |
| `src/router.ts` | route collection from metadata |
| `src/dispatcher.ts` | HTTP dispatcher with full lifecycle |
| `src/guards/auth.guard.ts` | Authorization guard |
| `src/interceptors/logging.interceptor.ts` | Logging interceptor (measures duration) |
| `src/pipes/zod-validation.pipe.ts` | Zod 4 validation pipe |
| `src/filters/exception.filter.ts` | Exception filter (maps errors to HTTP) |
| `src/context/request-context.ts` | AsyncLocalStorage wrapper for request ID |
| `src/services/user.service.ts` | Example service reading request context |
| `src/dto/create-user.dto.ts` | Zod schema for user creation |
| `src/tokens.ts` | shared injection tokens |
| `test/lifecycle-order.test.ts` | test proving exact lifecycle order |
| `test/` | vitest specs |

## Submission

Branch: `part-3-lifecycle` → Pull Request to `main`. Submit the PR link in the LMS.
