import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { REQUIRED_ROLES } from './auth.decorators';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
    if (!auth || !required.includes(auth.role)) throw new ForbiddenException('Anda tidak memiliki izin untuk tindakan ini');
    return true;
  }
}
