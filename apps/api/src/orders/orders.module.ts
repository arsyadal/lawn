import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TrackingController } from './tracking.controller';

@Module({
  controllers: [OrdersController, PaymentsController, TrackingController],
  providers: [OrdersService, PaymentsService],
})
export class OrdersModule {}
