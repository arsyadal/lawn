import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { AuthenticatedRequest } from './auth.types';
import { PUBLIC_ROUTE } from './auth.decorators';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

const SAFE_METHODS: Record<string, true> = { GET: true, HEAD: true, OPTIONS: true };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[AuthService.cookieName];
    if (typeof token !== 'string' || token.length > 200) throw new UnauthorizedException('Sesi tidak valid');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.authService.sessionHash(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Sesi telah berakhir');
    }
    request.auth = {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role,
      displayName: session.user.displayName,
      sessionId: session.id,
    };
    if (!SAFE_METHODS[request.method]) {
      const csrfToken = request.header('x-csrf-token');
      if (!csrfToken) throw new ForbiddenException('Token CSRF diperlukan');
      const actual = Buffer.from(this.authService.csrfHash(csrfToken));
      const expected = Buffer.from(session.csrfHash);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ForbiddenException('Token CSRF tidak valid');
    }
    return true;
  }
}
