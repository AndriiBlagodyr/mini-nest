import 'reflect-metadata';

import { Container, type Token } from './container.js';
import { getControllerPrefix } from './decorators/controller.js';
import { isInjectable } from './decorators/injectable.js';
import { getRoutes, type HttpMethod, type RouteMetadata } from './decorators/methods.js';
import { getParamsMetadata, type ParamMetadata } from './decorators/params.js';

export interface ResolvedRoute {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handlerName: string;
  controllerToken: Token;
  paramsMetadata: ParamMetadata[];
}

export class Router {
  private readonly routes: ResolvedRoute[] = [];

  constructor(private readonly container: Container) {}

  registerController(controller: new (...args: never[]) => unknown): void {
    const prefix = getControllerPrefix(controller);
    if (prefix === undefined) {
      throw new Error(`${controller.name} is not marked with @Controller()`);
    }

    if (!isInjectable(controller)) {
      throw new Error(`${controller.name} is not marked as @Injectable()`);
    }

    const routesMeta: RouteMetadata[] = getRoutes(controller);

    for (const route of routesMeta) {
      const fullPath = '/' + [prefix, route.path]
        .map((s) => s.replace(/^\/|\/$/g, ''))
        .filter(Boolean)
        .join('/');

      const paramNames: string[] = [];
      const patternStr = fullPath.replace(/:([^/]+)/g, (_match, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });

      const pattern = new RegExp(`^${patternStr}$`);
      const paramsMetadata = getParamsMetadata(controller, route.handlerName);

      this.routes.push({
        method: route.method,
        pattern,
        paramNames,
        handlerName: route.handlerName,
        controllerToken: controller,
        paramsMetadata,
      });
    }

    this.sortRoutes();
  }

  private sortRoutes(): void {
    this.routes.sort((a, b) => {
      if (a.method !== b.method) return 0;
      return a.paramNames.length - b.paramNames.length;
    });
  }

  match(method: string, pathname: string): { route: ResolvedRoute; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { route, params };
      }
    }
    return null;
  }
}
