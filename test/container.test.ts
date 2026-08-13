import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Inject } from '../src/decorators/inject.js';
import { Injectable } from '../src/decorators/injectable.js';
import { CONFIG_TOKEN, type AppConfig } from '../src/tokens.js';
import { A as CircularA } from './fixtures/circular-deps.js';

describe('Container', () => {
  it('resolves a dependency graph recursively (A -> B -> C)', () => {
    @Injectable()
    class C {
      readonly label = 'c';
    }

    @Injectable()
    class B {
      constructor(public readonly c: C) {}
    }

    @Injectable()
    class A {
      constructor(public readonly b: B) {}
    }

    const container = new Container();
    const a = container.resolve(A);

    expect(a).toBeInstanceOf(A);
    expect(a.b).toBeInstanceOf(B);
    expect(a.b.c).toBeInstanceOf(C);
    expect(a.b.c.label).toBe('c');
  });

  it('returns the same instance for singleton scope', () => {
    @Injectable()
    class Service {}

    const container = new Container();
    const first = container.resolve(Service);
    const second = container.resolve(Service);

    expect(first === second).toBe(true);
  });

  it('returns different instances for transient scope', () => {
    @Injectable({ scope: 'transient' })
    class Service {}

    const container = new Container();
    const first = container.resolve(Service);
    const second = container.resolve(Service);

    expect(first === second).toBe(false);
  });

  it('throws a meaningful error for circular dependencies', () => {
    const container = new Container();

    expect(() => container.resolve(CircularA)).toThrow(/A -> B -> A/);
    expect(() => container.resolve(CircularA)).not.toThrow(RangeError);
  });

  it('resolves dependencies via @Inject token', () => {
    @Injectable()
    class ConfigConsumer {
      constructor(@Inject(CONFIG_TOKEN) public readonly config: AppConfig) {}
    }

    const config: AppConfig = { apiUrl: 'https://api.example.com' };
    const container = new Container().register(CONFIG_TOKEN, config);
    const consumer = container.resolve(ConfigConsumer);

    expect(consumer.config).toBe(config);
    expect(consumer.config.apiUrl).toBe('https://api.example.com');
  });
});
