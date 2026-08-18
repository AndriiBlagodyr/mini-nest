import 'reflect-metadata';

import { Injectable } from '../../src/decorators/injectable.js';

@Injectable()
export class B {
  constructor(public a: unknown) {}
}

@Injectable()
export class A {
  constructor(public b: B) {}
}

Reflect.defineMetadata('design:paramtypes', [A], B);
