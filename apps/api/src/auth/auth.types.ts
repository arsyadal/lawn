import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  displayName: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}
