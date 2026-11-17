import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { APP_CONFIG, loadConfig } from '../src/config';
import { configureHttp } from '../src/http-setup';
import {
  EVENT_PUBLISHER,
  PAYMENT_REPOSITORY,
  PaymentEvent,
} from '../src/payments/application/ports';
import { InMemoryPaymentRepository } from '../src/payments/infrastructure/in-memory-payment.repository';
import { PaymentsController } from '../src/payments/interface/payments.controller';
import { paymentUseCaseProviders } from '../src/payments/payments.module';

const config = loadConfig({
  DATABASE_URL: 'postgres://unused',
  RABBITMQ_URL: 'amqp://unused',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  DEMO_USER_EMAIL: 'demo@payflow.dev',
  DEMO_USER_PASSWORD: 'correct-password',
});

const validBody = { payeeKey: 'loja@example.com', amountCents: 15_990, currency: 'BRL' };

/**
 * Exercises the real controllers, guards, pipes and use cases over HTTP.
 * Only PostgreSQL and RabbitMQ are replaced by in-memory doubles.
 */
describe('Payments HTTP API', () => {
  let app: INestApplication<App>;
  let published: PaymentEvent[];
  let token: string;

  beforeEach(async () => {
    published = [];
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: config.jwtSecret, signOptions: { expiresIn: 60 } })],
      controllers: [AuthController, PaymentsController],
      providers: [
        AuthService,
        JwtAuthGuard,
        ...paymentUseCaseProviders,
        { provide: APP_CONFIG, useValue: config },
        { provide: PAYMENT_REPOSITORY, useValue: new InMemoryPaymentRepository() },
        {
          provide: EVENT_PUBLISHER,
          useValue: { publish: async (event: PaymentEvent) => void published.push(event) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureHttp(app);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'demo@payflow.dev', password: 'correct-password' })
      .expect(200);
    token = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const createPayment = (key = 'order-0001', body: object = validBody) =>
    request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);

  it('rejects wrong credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'demo@payflow.dev', password: 'wrong' })
      .expect(401);
  });

  it('requires a bearer token', async () => {
    await request(app.getHttpServer()).get('/api/payments').expect(401);
    await request(app.getHttpServer())
      .get('/api/payments')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });

  it('creates a payment and publishes an event', async () => {
    const response = await createPayment().expect(201);

    expect(response.body).toMatchObject({ ...validBody, status: 'PENDING', description: null });
    expect(published.map((event) => event.type)).toEqual(['payment.created']);
    expect(published[0].data.paymentId).toBe(response.body.id);
  });

  it('replays the same Idempotency-Key with 200 and a single payment', async () => {
    const first = await createPayment().expect(201);
    const retry = await createPayment().expect(200);

    expect(retry.body.id).toBe(first.body.id);
    expect(published).toHaveLength(1);
    const list = await request(app.getHttpServer())
      .get('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.total).toBe(1);
  });

  it('answers 409 when the key is reused with another payload', async () => {
    await createPayment().expect(201);
    await createPayment('order-0001', { ...validBody, amountCents: 1 }).expect(409);
  });

  it('validates the header and the body', async () => {
    await createPayment('short').expect(400);
    await createPayment('order-0002', { ...validBody, amountCents: 10.5 }).expect(400);
    await createPayment('order-0003', { ...validBody, currency: 'EUR' }).expect(400);
    await createPayment('order-0004', { ...validBody, isAdmin: true }).expect(400);
    expect(published).toHaveLength(0);
  });

  it('settles a payment once and refuses a second transition', async () => {
    const { body: payment } = await createPayment().expect(201);
    const settle = () =>
      request(app.getHttpServer())
        .post(`/api/payments/${payment.id}/settle`)
        .set('Authorization', `Bearer ${token}`);

    const settled = await settle().expect(200);
    expect(settled.body.status).toBe('SETTLED');
    await settle().expect(409);
    expect(published.map((event) => event.type)).toEqual(['payment.created', 'payment.settled']);
  });

  it('fails a payment with a reason and filters the list by status', async () => {
    const { body: failed } = await createPayment('order-0001').expect(201);
    await createPayment('order-0002').expect(201);

    await request(app.getHttpServer())
      .post(`/api/payments/${failed.id}/fail`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Saldo insuficiente' })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/payments?status=FAILED&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(list.body.items[0]).toMatchObject({
      id: failed.id,
      failureReason: 'Saldo insuficiente',
    });
  });

  it('answers 404 for unknown payments and 400 for malformed ids', async () => {
    const get = (id: string) =>
      request(app.getHttpServer())
        .get(`/api/payments/${id}`)
        .set('Authorization', `Bearer ${token}`);

    await get('3f2c1b9e-6a4d-4c8e-9b7a-2d1e0f9c8b7a').expect(404);
    await get('not-a-uuid').expect(400);
  });
});
