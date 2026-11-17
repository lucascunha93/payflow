import { IdempotencyConflictError } from '../domain/errors';
import { Payment } from '../domain/payment';
import { InMemoryPaymentRepository } from '../infrastructure/in-memory-payment.repository';
import { CreatePaymentCommand, CreatePaymentUseCase } from './create-payment.use-case';
import { DuplicateIdempotencyKeyError, EventPublisher, PaymentEvent } from './ports';

const now = new Date('2026-01-10T12:00:00Z');

const command: CreatePaymentCommand = {
  payerId: 'u-1',
  payeeKey: 'loja@example.com',
  amountCents: 15_990,
  currency: 'BRL',
  idempotencyKey: 'key-0001',
};

function setup(publisher?: EventPublisher) {
  const repository = new InMemoryPaymentRepository();
  const published: PaymentEvent[] = [];
  const events: EventPublisher = publisher ?? {
    publish: async (event) => {
      published.push(event);
    },
  };
  let sequence = 0;
  const useCase = new CreatePaymentUseCase(
    repository,
    events,
    { now: () => now },
    { next: () => `id-${++sequence}` },
  );
  return { useCase, repository, published };
}

describe('CreatePaymentUseCase', () => {
  it('stores the payment and publishes payment.created', async () => {
    const { useCase, repository, published } = setup();

    const { payment, created } = await useCase.execute(command);

    expect(created).toBe(true);
    expect(await repository.findById(payment.id)).not.toBeNull();
    expect(published).toEqual([
      {
        eventId: 'id-2',
        type: 'payment.created',
        occurredAt: now.toISOString(),
        data: {
          paymentId: 'id-1',
          payerId: 'u-1',
          payeeKey: 'loja@example.com',
          amountCents: 15_990,
          currency: 'BRL',
          status: 'PENDING',
          failureReason: null,
        },
      },
    ]);
  });

  it('returns the stored payment on a retry without publishing again', async () => {
    const { useCase, published } = setup();
    const first = await useCase.execute(command);

    const retry = await useCase.execute(command);

    expect(retry.created).toBe(false);
    expect(retry.payment.id).toBe(first.payment.id);
    expect(published).toHaveLength(1);
  });

  it('rejects a reused key that carries a different payload', async () => {
    const { useCase } = setup();
    await useCase.execute(command);

    await expect(useCase.execute({ ...command, amountCents: 1 })).rejects.toThrow(
      IdempotencyConflictError,
    );
  });

  it('scopes idempotency keys to the payer', async () => {
    const { useCase } = setup();
    const first = await useCase.execute(command);

    const other = await useCase.execute({ ...command, payerId: 'u-2' });

    expect(other.created).toBe(true);
    expect(other.payment.id).not.toBe(first.payment.id);
  });

  it('returns the winner when a concurrent request inserts the same key first', async () => {
    const { useCase, repository, published } = setup();
    const winner = Payment.create({ ...command, id: 'winner', now });
    let lookups = 0;
    jest.spyOn(repository, 'findByIdempotencyKey').mockImplementation(async () => {
      // First lookup happens before the competing insert; the second one sees it.
      return ++lookups === 1 ? null : winner;
    });
    jest.spyOn(repository, 'insert').mockRejectedValue(new DuplicateIdempotencyKeyError());

    const result = await useCase.execute(command);

    expect(result).toEqual({ payment: winner, created: false });
    expect(published).toHaveLength(0);
  });

  it('keeps the payment when the broker is unavailable', async () => {
    const { useCase, repository } = setup({
      publish: async () => {
        throw new Error('broker down');
      },
    });

    const { payment, created } = await useCase.execute(command);

    expect(created).toBe(true);
    expect(await repository.findById(payment.id)).not.toBeNull();
  });
});
