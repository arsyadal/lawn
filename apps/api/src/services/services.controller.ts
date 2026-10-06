import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { CreateServiceDto, UpdateServiceDto } from './service.dto';
import { ServicesService } from './services.service';

@Controller('api/services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query('includeInactive') includeInactive?: string) {
    return this.services.list(auth.tenantId, includeInactive === 'true');
  }

  @Get(':id')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.services.detail(auth.tenantId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateServiceDto) {
    return this.services.create(auth.tenantId, input);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':id')
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateServiceDto) {
    return this.services.update(auth.tenantId, id, input);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  deactivate(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.services.deactivate(auth.tenantId, id);
  }
}
