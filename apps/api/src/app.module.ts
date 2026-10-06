import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { SessionGuard } from './auth/session.guard';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { ReportsModule } from './reports/reports.module';
import { ServicesModule } from './services/services.module';
import { StorageModule } from './storage/storage.module';
import { TeamModule } from './team/team.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [DatabaseModule, AuthModule, CustomersModule, ServicesModule, OrdersModule, StorageModule, ReportsModule, TeamModule, TenantModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
