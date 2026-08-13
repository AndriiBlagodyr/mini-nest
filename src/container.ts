import 'reflect-metadata';

import { getInjectTokens } from './decorators/inject.js';
import { getScope, isInjectable } from './decorators/injectable.js';

export type Provider = unknown;
export type Token = symbol | string | (new (...args: never[]) => unknown);

export class Container {
  private readonly singletons = new Map<Token, unknown>();
  private readonly providers = new Map<Token, Provider>();

  register(token: Token, value: Provider): this {
    this.providers.set(token, value);
    return this;
  }

  resolve<T>(target: new (...args: never[]) => T): T {
    return this.resolveToken(target, []) as T;
  }

  private resolveToken(token: Token, path: object[]): unknown {
    if (typeof token !== 'function') {
      if (!this.providers.has(token)) {
        throw new Error(`No provider registered for token ${String(token)}`);
      }
      return this.providers.get(token);
    }

    const ctor = token;

    if (!isInjectable(ctor)) {
      throw new Error(`${ctor.name} is not marked as @Injectable()`);
    }

    if (path.includes(ctor)) {
      const chain = [...path.map((t) => (t as { name: string }).name), ctor.name];
      throw new Error(`Circular dependency detected: ${chain.join(' -> ')}`);
    }

    const scope = getScope(ctor);

    if (scope === 'singleton' && this.singletons.has(ctor)) {
      return this.singletons.get(ctor);
    }

    const nextPath = [...path, ctor];
    const paramTypes: (new (...args: never[]) => unknown)[] =
      Reflect.getMetadata('design:paramtypes', ctor) ?? [];
    const injectTokens = getInjectTokens(ctor);

    const deps = paramTypes.map((type, index) => {
      const explicitToken = injectTokens[index];
      if (explicitToken !== undefined) {
        return this.resolveToken(explicitToken, nextPath);
      }

      if (type === undefined || type === Object) {
        throw new Error(
          `Cannot resolve parameter ${index} of ${ctor.name}: missing type or @Inject token`,
        );
      }

      return this.resolveToken(type, nextPath);
    });

    const instance = new ctor(...(deps as never[]));

    if (scope === 'singleton') {
      this.singletons.set(ctor, instance);
    }

    return instance;
  }
}
