import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get } from '../src/decorators/methods.js';
import { Param } from '../src/decorators/params.js';
import { Dispatcher } from '../src/dispatcher.js';
import { AuthGuard } from '../src/guards/auth.guard.js';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor.js';

@Injectable()
@Controller('lifecycle')
class LifecycleController {
  @Get(':id')
  handle(@Param('id') id: string) {
    return { id };
  }
}

describe('Lifecycle order', () => {
  let dispatcher: Dispatcher;
  let baseUrl: string;

  beforeAll(async () => {
    const container = new Container();
    dispatcher = new Dispatcher(container);

    dispatcher.useMiddleware(async () => {});
    dispatcher.useGuard(new AuthGuard());
    dispatcher.useInterceptor(new LoggingInterceptor(() => {}));
    dispatcher.registerController(LifecycleController);

    const server = await dispatcher.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await dispatcher.close();
  });

  it('executes lifecycle stages in exact order: middleware → guard → interceptor:before → pipe → handler → interceptor:after', async () => {
    const order: string[] = [];

    dispatcher.setHooks({
      onMiddleware: () => order.push('middleware'),
      onGuard: () => order.push('guard'),
      onInterceptorBefore: () => order.push('interceptor:before'),
      onPipe: () => order.push('pipe'),
      onHandler: () => order.push('handler'),
      onInterceptorAfter: () => order.push('interceptor:after'),
    });

    await fetch(`${baseUrl}/lifecycle/1`, {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(order).toEqual([
      'middleware',
      'guard',
      'interceptor:before',
      'pipe',
      'handler',
      'interceptor:after',
    ]);
  });
});
