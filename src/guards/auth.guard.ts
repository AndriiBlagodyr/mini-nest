import type { IncomingMessage } from 'node:http';

export interface Guard {
  canActivate(req: IncomingMessage): boolean | Promise<boolean>;
}

export class AuthGuard implements Guard {
  canActivate(req: IncomingMessage): boolean {
    const auth = req.headers['authorization'];
    return !!auth && auth.length > 0;
  }
}
