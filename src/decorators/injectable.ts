import 'reflect-metadata';

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}

export const INJECTABLE_KEY = Symbol('mini-nest:injectable');
export const SCOPE_KEY = 'mini-nest:scope';

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE_KEY, true, target);
    Reflect.defineMetadata(SCOPE_KEY, options.scope ?? 'singleton', target);
  };
}

export function getScope(target: object): Scope {
  return Reflect.getMetadata(SCOPE_KEY, target) ?? 'singleton';
}

export function isInjectable(target: object): boolean {
  return Reflect.getMetadata(INJECTABLE_KEY, target) === true;
}
