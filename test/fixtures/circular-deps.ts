import 'reflect-metadata';

import { Injectable } from '../../src/decorators/injectable.js';

@Injectable()
export class A {
  constructor(_b: unknown) {}
}

@Injectable()
export class B {
  constructor(_a: unknown) {}
}

Reflect.defineMetadata('design:paramtypes', [B], A);
Reflect.defineMetadata('design:paramtypes', [A], B);
