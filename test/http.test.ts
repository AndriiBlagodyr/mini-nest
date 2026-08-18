import 'reflect-metadata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Controller } from '../src/decorators/controller.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Get, Post } from '../src/decorators/methods.js';
import { Body, Param, Query } from '../src/decorators/params.js';
import { Dispatcher } from '../src/dispatcher.js';
import { CreateUserDto } from '../src/dto/create-user.dto.js';

@Injectable()
class UserService {
  private readonly users: { id: string; name: string; email: string }[] = [];

  create(name: string, email: string) {
    const user = { id: String(this.users.length + 1), name, email };
    this.users.push(user);
    return user;
  }

  findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  findAll(limit?: string) {
    return limit ? this.users.slice(0, Number(limit)) : this.users;
  }
}

@Injectable()
@Controller('users')
class UserController {
  constructor(public readonly userService: UserService) {}

  @Get(':id')
  getUser(@Param('id') id: string) {
    return { id };
  }

  @Get('')
  listUsers(@Query('limit') limit: string) {
    return { limit };
  }

  @Post('')
  createUser(@Body() dto: CreateUserDto) {
    return { name: dto.name, email: dto.email, isDto: dto instanceof CreateUserDto };
  }
}

describe('HTTP Dispatcher', () => {
  let dispatcher: Dispatcher;
  let container: Container;
  let baseUrl: string;

  beforeAll(async () => {
    container = new Container();
    dispatcher = new Dispatcher(container);
    dispatcher.registerController(UserController);
    const server = await dispatcher.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await dispatcher.close();
  });

  it('matches a route with @Controller prefix + @Get path', async () => {
    const res = await fetch(`${baseUrl}/users/42`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('42');
  });

  it('@Param delivers route parameter to method argument', async () => {
    const res = await fetch(`${baseUrl}/users/99`);
    const body = await res.json();
    expect(body.id).toBe('99');
  });

  it('@Query delivers query parameter to method argument', async () => {
    const res = await fetch(`${baseUrl}/users?limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe('5');
  });

  it('@Body delivers parsed JSON to method argument', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('John');
    expect(body.email).toBe('john@example.com');
  });

  it('validation rejects invalid DTO with 400 and field name', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'J', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).toMatch(/email/);
  });

  it('validation passes and handler receives DTO instance', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isDto).toBe(true);
  });

  it('controller receives service from container (singleton)', () => {
    const ctrl1 = container.resolve(UserController);
    const ctrl2 = container.resolve(UserController);
    expect(ctrl1.userService).toBe(ctrl2.userService);
  });

  it('returns 404 for unmatched routes', async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
