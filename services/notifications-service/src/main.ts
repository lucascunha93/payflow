import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config';
import type { AppConfig } from './config';

/** Hybrid application: consumes payment events from RabbitMQ and serves the feed over HTTP. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [config.rabbitmqUrl],
      queue: config.eventsQueue,
      queueOptions: { durable: true },
      // Manual acknowledgement: a message only leaves the queue after it is stored.
      noAck: false,
      prefetchCount: 10,
    },
  });

  app.use(helmet());
  app.enableCors({ origin: config.corsOrigin });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  await app.startAllMicroservices();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`notifications-service listening on port ${config.port}`);
}

void bootstrap();
