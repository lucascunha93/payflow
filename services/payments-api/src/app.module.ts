import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { APP_CONFIG } from './config';
import type { AppConfig } from './config';
import { AppConfigModule } from './config.module';
import { HealthController } from './health.controller';
import { CreatePayments1760000000000 } from './payments/infrastructure/migrations/1760000000000-create-payments';
import { PaymentOrmEntity } from './payments/infrastructure/payment.orm-entity';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        type: 'postgres' as const,
        url: config.databaseUrl,
        entities: [PaymentOrmEntity],
        migrations: [CreatePayments1760000000000],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    AuthModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
