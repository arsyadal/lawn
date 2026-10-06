import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { ORDER_STATUSES } from '@lawn/contracts';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { CreateOrderDto, TransitionOrderDto, UpdateOrderDto, UpdateTreatmentNotesDto } from './order.dto';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './payment.dto';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly payments: PaymentsService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('overdue') overdue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (status && !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) throw new BadRequestException('Status tidak valid');
    return this.orders.list(auth.tenantId, { search, status: status as OrderStatus | undefined, overdue: overdue === 'true', page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get(':id')
  detail(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(auth, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateOrderDto) {
    return this.orders.create(auth, input);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':id')
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateOrderDto) {
    return this.orders.update(auth, id, input);
  }

  @Patch(':orderId/items/:itemId')
  updateItem(
    @CurrentAuth() auth: AuthContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateTreatmentNotesDto,
  ) {
    return this.orders.updateTreatmentNotes(auth, orderId, itemId, input.treatmentNotes);
  }

  @Post(':id/status')
  transition(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: TransitionOrderDto) {
    return this.orders.transition(auth, id, input.status as OrderStatus, input.note);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':id/tracking-token/rotate')
  rotateTrackingToken(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.rotateTrackingToken(auth, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Get(':id/payments')
  listPayments(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.listForOrder(auth.tenantId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':id/payments')
  recordPayment(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: RecordPaymentDto) {
    return this.payments.record(auth, id, input);
  }
}
