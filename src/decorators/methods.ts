import 'reflect-metadata';

export type HttpMethod = 'GET' | 'POST';

export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  handlerName: string;
}

export const ROUTES_KEY = 'mini-nest:routes';

function createMethodDecorator(method: HttpMethod) {
  return (path: string = ''): MethodDecorator => {
    return (target, propertyKey) => {
      const routes: RouteMetadata[] =
        Reflect.getMetadata(ROUTES_KEY, target.constructor) ?? [];
      routes.push({ method, path, handlerName: String(propertyKey) });
      Reflect.defineMetadata(ROUTES_KEY, routes, target.constructor);
    };
  };
}

export const Get = createMethodDecorator('GET');
export const Post = createMethodDecorator('POST');

export function getRoutes(target: object): RouteMetadata[] {
  return Reflect.getMetadata(ROUTES_KEY, target) ?? [];
}
