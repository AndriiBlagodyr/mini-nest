import { Injectable } from '../decorators/injectable.js';
import { getRequestId } from '../context/request-context.js';

@Injectable()
export class UserService {
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

  getCurrentRequestId(): string | undefined {
    return getRequestId();
  }
}
