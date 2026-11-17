import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config';
import type { AppConfig } from './config';
import { configureHttp } from './http-setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  app.set('trust proxy', config.trustProxyHops);
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigin });
  app.enableShutdownHooks();
  configureHttp(app);

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Payflow — Payments API')
      .setDescription('Criação e liquidação de pagamentos com idempotência e eventos.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);
  new Logger('Bootstrap').log(`payments-api listening on port ${config.port}`);
}

void bootstrap();
