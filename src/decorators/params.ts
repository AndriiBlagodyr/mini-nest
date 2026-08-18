import 'reflect-metadata';

export type ParamType = 'body' | 'param' | 'query';

export interface ParamMetadata {
  index: number;
  type: ParamType;
  name?: string;
}

export const PARAMS_KEY = 'mini-nest:params';

function createParamDecorator(type: ParamType, name?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const key = String(propertyKey);
    const existing: ParamMetadata[] =
      Reflect.getMetadata(PARAMS_KEY, target.constructor, key) ?? [];
    existing.push({ index: parameterIndex, type, name });
    Reflect.defineMetadata(PARAMS_KEY, existing, target.constructor, key);
  };
}

export function Body(): ParameterDecorator {
  return createParamDecorator('body');
}

export function Param(name: string): ParameterDecorator {
  return createParamDecorator('param', name);
}

export function Query(name: string): ParameterDecorator {
  return createParamDecorator('query', name);
}

export function getParamsMetadata(target: object, methodName: string): ParamMetadata[] {
  return Reflect.getMetadata(PARAMS_KEY, target, methodName) ?? [];
}
