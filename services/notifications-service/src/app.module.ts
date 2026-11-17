import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, loadConfig } from './config';
import type { AppConfig } from './config';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  MongoNotificationStore,
  NotificationDocument,
  NotificationSchema,
} from './notifications/mongo-notification.store';
import { NOTIFICATION_STORE } from './notifications/notification';
import { NotificationsController } from './notifications/notifications.controller';
import { PaymentEventsConsumer } from './notifications/payment-events.consumer';
import { RecordPaymentEvent } from './notifications/record-payment-event';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}

@Module({
  imports: [
    AppConfigModule,
    MongooseModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ uri: config.mongodbUrl }),
    }),
    MongooseModule.forFeature([{ name: NotificationDocument.name, schema: NotificationSchema }]),
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [HealthController, NotificationsController, PaymentEventsConsumer],
  providers: [
    JwtAuthGuard,
    RecordPaymentEvent,
    { provide: NOTIFICATION_STORE, useClass: MongoNotificationStore },
  ],
})
export class AppModule {}
