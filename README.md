# mini-nest

A minimal IoC container and HTTP framework inspired by NestJS — parts 1–2 of a 3-part series (decorators, metadata, dependency graph, routing, validation).

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

This two-phase design (record at decoration time, resolve at call time) is the same pattern NestJS uses internally.

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
| `src/dispatcher.ts` | HTTP layer over `node:http` |
| `src/pipes/validation.pipe.ts` | DTO validation pipe |
| `src/dto/create-user.dto.ts` | example DTO with class-validator rules |
| `src/tokens.ts` | shared injection tokens |
| `test/` | vitest specs |
| `TASK.md` | assignment description |

## Submission

Branch: `part-2-http` → Pull Request to `main`. Submit the PR link in the LMS.
