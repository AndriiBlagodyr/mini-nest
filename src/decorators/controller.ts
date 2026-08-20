import 'reflect-metadata';

export const CONTROLLER_PREFIX_KEY = 'mini-nest:controller-prefix';

export function Controller(prefix: string = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONTROLLER_PREFIX_KEY, prefix, target);
  };
}

export function getControllerPrefix(target: object): string | undefined {
  return Reflect.getMetadata(CONTROLLER_PREFIX_KEY, target);
}
