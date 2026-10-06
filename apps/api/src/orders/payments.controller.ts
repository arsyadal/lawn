import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { PaymentsService } from './payments.service';

@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.payments.list(auth.tenantId, Number(page) || 1, Number(limit) || 20);
  }
}
