# mini-nest

A minimal IoC container inspired by NestJS — part 1 of a 3-part series (decorators, metadata, dependency graph).

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

## Project layout

| Path | Purpose |
|------|---------|
| `src/decorators/injectable.ts` | `@Injectable()` class decorator |
| `src/decorators/inject.ts` | `@Inject(token)` parameter decorator |
| `src/container.ts` | dependency resolver |
| `src/tokens.ts` | shared injection tokens |
| `test/` | vitest specs |
| `TASK.md` | assignment description |

## Submission

Branch: `part-1-ioc` → Pull Request to `main`. Submit the PR link in the LMS.
