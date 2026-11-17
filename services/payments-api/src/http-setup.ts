import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DomainErrorFilter } from './payments/interface/domain-error.filter';

/** HTTP behaviour shared by the real server and the HTTP tests. */
export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
}
