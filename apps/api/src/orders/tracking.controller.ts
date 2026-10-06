import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { OrdersService } from './orders.service';

@Controller('api/track')
export class TrackingController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Get(':token')
  track(@Param('token') token: string) {
    return this.orders.publicTracking(token);
  }
}
