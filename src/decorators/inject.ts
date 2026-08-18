import 'reflect-metadata';

export const INJECT_TOKEN_KEY = 'mini-nest:inject';

export function Inject(token: symbol | string): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existing: Record<number, symbol | string> =
      Reflect.getOwnMetadata(INJECT_TOKEN_KEY, target) ?? {};
    existing[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKEN_KEY, existing, target);
  };
}

export function getInjectTokens(
  target: object,
): Record<number, symbol | string> {
  return Reflect.getOwnMetadata(INJECT_TOKEN_KEY, target) ?? {};
}
