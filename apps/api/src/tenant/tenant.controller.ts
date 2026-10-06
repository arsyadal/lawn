import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UpdateTenantDto } from './tenant.dto';

@Controller('api/settings')
export class TenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  profile(@CurrentAuth() auth: AuthContext) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { id: true, businessName: true, phone: true, address: true, createdAt: true, updatedAt: true } });
  }

  @Roles(UserRole.OWNER)
  @Patch()
  update(@CurrentAuth() auth: AuthContext, @Body() input: UpdateTenantDto) {
    return this.prisma.tenant.update({
      where: { id: auth.tenantId },
      data: {
        ...(input.businessName !== undefined ? { businessName: input.businessName.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.address !== undefined ? { address: input.address.trim() } : {}),
      },
      select: { id: true, businessName: true, phone: true, address: true, createdAt: true, updatedAt: true },
    });
  }
}
