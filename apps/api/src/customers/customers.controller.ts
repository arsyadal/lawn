import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { CustomersService } from './customers.service';

@Controller('api/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.customers.list(auth.tenantId, search, Number(page) || 1, Number(limit) || 20);
  }

  @Get(':id')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.detail(auth.tenantId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateCustomerDto) {
    return this.customers.create(auth.tenantId, input);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':id')
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateCustomerDto) {
    return this.customers.update(auth.tenantId, id, input);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(auth.tenantId, id);
  }
}
