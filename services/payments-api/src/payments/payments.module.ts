import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { AuthModule } from '../auth/auth.module';
import { APP_CONFIG } from '../config';
import type { AppConfig } from '../config';
import { CreatePaymentUseCase } from './application/create-payment.use-case';
import { PaymentQueries } from './application/payment-queries';
import { CLOCK, EVENT_PUBLISHER, ID_GENERATOR, PAYMENT_REPOSITORY } from './application/ports';
import { ResolvePaymentUseCase } from './application/resolve-payment.use-case';
import { PaymentOrmEntity } from './infrastructure/payment.orm-entity';
import { PAYMENT_EVENTS_CLIENT, RmqEventPublisher } from './infrastructure/rmq-event-publisher';
import { TypeOrmPaymentRepository } from './infrastructure/typeorm-payment.repository';
import { PaymentsController } from './interface/payments.controller';

/** Use cases and their framework-independent collaborators; reused by the HTTP tests. */
export const paymentUseCaseProviders = [
  CreatePaymentUseCase,
  ResolvePaymentUseCase,
  PaymentQueries,
  { provide: CLOCK, useValue: { now: () => new Date() } },
  { provide: ID_GENERATOR, useValue: { next: () => randomUUID() } },
];

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PaymentOrmEntity]),
    ClientsModule.registerAsync([
      {
        name: PAYMENT_EVENTS_CLIENT,
        inject: [APP_CONFIG],
        useFactory: (config: AppConfig) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.rabbitmqUrl],
            queue: config.eventsQueue,
            queueOptions: { durable: true },
            persistent: true,
          },
        }),
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    ...paymentUseCaseProviders,
    { provide: PAYMENT_REPOSITORY, useClass: TypeOrmPaymentRepository },
    { provide: EVENT_PUBLISHER, useClass: RmqEventPublisher },
  ],
})
export class PaymentsModule {}
