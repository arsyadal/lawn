import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { ReportsService } from './reports.service';

@Controller('api')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentAuth() auth: AuthContext) {
    return this.reports.dashboard(auth.tenantId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Get('reports')
  report(@CurrentAuth() auth: AuthContext, @Query('preset') preset?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.report(auth.tenantId, preset, from, to);
  }
}
