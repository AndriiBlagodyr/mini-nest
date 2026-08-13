# Homework — Part 1: IoC Container

## Brief

Build your own IoC container that does what NestJS does under the hood: reads type metadata from constructors and assembles the dependency graph automatically.

After this assignment, `@Injectable()` in Nest will no longer feel like magic — you will know it is exactly two lines of `Reflect.defineMetadata`.

This is **part 1 of 3**. Lecture 7 adds controllers and DTOs; Lecture 8 adds pipes, guards, interceptors, and filters. Write the code so it is easy to extend.

## What to do

### 1. `@Injectable()`

A class decorator that marks a class as eligible for creation by the container.

### 2. Resolve via `design:paramtypes`

When a class is decorated and `emitDecoratorMetadata` is enabled, TypeScript stores constructor parameter types in metadata. Your container reads them via `Reflect.getMetadata('design:paramtypes', Target)` and recursively creates each dependency.

### 3. `@Inject(token)`

A parameter decorator for cases where the type is not enough: interfaces do not exist at runtime, so they need an explicit token (Symbol or string).

### 4. Scopes

| Scope | Behavior |
|-------|----------|
| `singleton` | default — one instance per container |
| `transient` | new instance on every resolve |

Scope is set via the decorator argument: `@Injectable({ scope: 'transient' })`.

### 5. Circular dependency detection

`A → B → A` must fail with a clear error that names the full chain (`A -> B -> A`), not `RangeError: Maximum call stack size exceeded`.

### 6. Tests are required

Minimum coverage:

- resolve a simple dependency graph
- singleton returns the same instance
- transient returns different instances
- a cycle throws an error with the chain
- `@Inject` with a token works

**Constraints.** Allowed: `reflect-metadata`, any test runner (vitest, node:test, jest). Forbidden: `@nestjs/*`, `inversify`, `tsyringe`, `typedi` — the container is yours. Use TypeScript 6.x (`npm i -D typescript@6`); version 7 just shipped and adds nothing for this homework. Code runs in the Docker setup from Homework #5.

## Tips that save hours

- `import 'reflect-metadata'` must be the **first line** of the entry point and the test setup file.
- `design:paramtypes` appears only if the class has at least one decorator — a class without `@Injectable()` will not get metadata even with `emitDecoratorMetadata` enabled.
- Interfaces in metadata become `Object` — that is why `@Inject(token)` is needed: type erasure, not a limitation of your implementation.
- For cycle detection, keep a Set (or array) of the resolve path and pass it recursively; when entering a class already in the path, throw an error with `[...path, current].join(' -> ')`.

## Acceptance criteria

- [ ] No third-party containers. `grep -RE "@nestjs|inversify|tsyringe|typedi" package.json src/` produces no matches.
- [ ] `tsconfig.json` enables metadata. Contains `"experimentalDecorators": true` and `"emitDecoratorMetadata": true` — `grep -E 'experimentalDecorators|emitDecoratorMetadata' tsconfig.json` produces two matches.
- [ ] Resolve uses metadata, not a manual list. Code contains `Reflect.getMetadata('design:paramtypes'` — `grep -rn "design:paramtypes" src/` produces a match.
- [ ] Graph is built recursively. A test where A depends on B and B on C; `container.resolve(A)` returns an instance with a live C inside.
- [ ] Singleton. `container.resolve(X) === container.resolve(X)` → `true` for a class without an explicit scope.
- [ ] Transient. For a class with `@Injectable({ scope: 'transient' })`, the same expression → `false`.
- [ ] `@Inject(token)` works. A test where the dependency is registered under `Symbol.for('CONFIG')` and resolves by token, not by type.
- [ ] Cycle produces a meaningful error. A test checks that the message contains all class names in the chain (e.g. matches `/A -> B -> A/`) and that it is not a `RangeError`.
- [ ] Tests pass. `npm test` exits with code 0; output shows at least 5 passed tests.
- [ ] Works in Docker. `docker compose run --rm api npm test` passes (reuse the image from Homework #5).

## Submission format

**Repository:** public GitHub repo `mini-nest` (it will live through Lecture 8) + Pull Request from branch `part-1-ioc`.

**Structure:**

| File | Purpose |
|------|---------|
| `src/decorators/injectable.ts` | `@Injectable()` decorator |
| `src/decorators/inject.ts` | `@Inject(token)` parameter decorator |
| `src/container.ts` | the container itself |
| `src/tokens.ts` | symbol tokens |
| `test/` | tests |
| `README.md` | how to run + a "how it works" paragraph |

**README requirement:** a separate "how it works" paragraph — where `design:paramtypes` comes from and why nothing works without `emitDecoratorMetadata`.

In the LMS, submit the **PR link**, not the main branch.

## Relation to the course project

This is a training artifact outside the course project — it does not relate to the Marketplace API.

Its goal is to walk the same path Nest authors took, so that in Lectures 7–8 you see familiar mechanisms instead of "magic tags". When Lecture 8 covers how a guard differs from an interceptor, you will already know where in the lifecycle they are invoked because you wrote something similar yourself.

A finished mini-Nest is a strong portfolio item: it shows understanding of runtime reflection, not just reading documentation.
