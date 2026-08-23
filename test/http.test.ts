import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get, Post } from '../src/decorators/methods.js';
import { Body, Param, Query } from '../src/decorators/params.js';
import { Dispatcher } from '../src/dispatcher.js';
import { AuthGuard } from '../src/guards/auth.guard.js';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor.js';
import { NotFoundError } from '../src/filters/exception.filter.js';
import { CreateUserSchema, type CreateUserDto } from '../src/dto/create-user.dto.js';
import { UserService } from '../src/services/user.service.js';
import { getRequestId } from '../src/context/request-context.js';

@Injectable()
@Controller('users')
class UserController {
  constructor(public readonly userService: UserService) {}

  @Get(':id')
  getUser(@Param('id') id: string) {
    const requestId = this.userService.getCurrentRequestId();
    return { id, requestId };
  }

  @Get('')
  listUsers(@Query('limit') limit: string) {
    return { limit };
  }

  @Post('')
  createUser(@Body() dto: CreateUserDto) {
    return { name: dto.name, email: dto.email };
  }

  @Get('error')
  throwError() {
    throw new Error('boom');
  }

  @Get('not-found')
  throwNotFound() {
    throw new NotFoundError('User not found');
  }
}

describe('HTTP Dispatcher (part 3)', () => {
  let dispatcher: Dispatcher;
  let container: Container;
  let baseUrl: string;
  const logs: string[] = [];

  beforeAll(async () => {
    container = new Container();
    dispatcher = new Dispatcher(container);
    dispatcher.useGuard(new AuthGuard());
    dispatcher.useInterceptor(new LoggingInterceptor((msg) => logs.push(msg)));
    dispatcher.usePipe('createUser', CreateUserSchema);
    dispatcher.registerController(UserController);

    const server = await dispatcher.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await dispatcher.close();
  });

  it('guard blocks request without Authorization → 403', async () => {
    const res = await fetch(`${baseUrl}/users/1`);
    expect(res.status).toBe(403);
  });

  it('guard allows request with Authorization', async () => {
    const res = await fetch(`${baseUrl}/users/1`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('1');
  });

  it('interceptor logs method, path and duration in ms', async () => {
    logs.length = 0;
    await fetch(`${baseUrl}/users/1`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toMatch(/GET \/users\/1/);
    expect(logs[0]).toMatch(/[0-9]+(\.[0-9]+)? ?ms/);
  });

  it('pipe with Zod rejects invalid body → 400 with field names', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
      body: JSON.stringify({ name: 'J', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).toMatch(/email/);
  });

  it('pipe with Zod passes valid body', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Alice');
    expect(body.email).toBe('alice@example.com');
  });

  it('exception filter hides internal error details (500, no "boom")', async () => {
    const res = await fetch(`${baseUrl}/users/error`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/boom|at .*\.ts:/);
  });

  it('NotFoundError maps to 404 with message', async () => {
    const res = await fetch(`${baseUrl}/users/not-found`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('User not found');
  });

  it('X-Request-Id is returned in response header', async () => {
    const res = await fetch(`${baseUrl}/users/1`, {
      headers: { Authorization: 'Bearer token' },
    });
    const requestId = res.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThan(0);
  });

  it('X-Request-Id from client is echoed back', async () => {
    const customId = 'my-custom-request-id-123';
    const res = await fetch(`${baseUrl}/users/1`, {
      headers: {
        Authorization: 'Bearer token',
        'X-Request-Id': customId,
      },
    });
    expect(res.headers.get('x-request-id')).toBe(customId);
  });

  it('AsyncLocalStorage provides requestId deep in service without parameter', async () => {
    const res = await fetch(`${baseUrl}/users/1`, {
      headers: { Authorization: 'Bearer token' },
    });
    const body = await res.json();
    const responseRequestId = res.headers.get('x-request-id');
    expect(body.requestId).toBe(responseRequestId);
  });

  it('parallel requests do not mix request contexts', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `req-${i}`);
    const responses = await Promise.all(
      ids.map((id) =>
        fetch(`${baseUrl}/users/1`, {
          headers: {
            Authorization: 'Bearer token',
            'X-Request-Id': id,
          },
        }).then(async (res) => ({
          sentId: id,
          receivedId: res.headers.get('x-request-id'),
          bodyId: (await res.json()).requestId,
        })),
      ),
    );

    for (const r of responses) {
      expect(r.receivedId).toBe(r.sentId);
      expect(r.bodyId).toBe(r.sentId);
    }
  });

  it('controller receives service from container (singleton)', () => {
    const ctrl1 = container.resolve(UserController);
    const ctrl2 = container.resolve(UserController);
    expect(ctrl1.userService).toBe(ctrl2.userService);
  });

  it('@Query delivers query parameter to method argument', async () => {
    const res = await fetch(`${baseUrl}/users?limit=5`, {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe('5');
  });
});
