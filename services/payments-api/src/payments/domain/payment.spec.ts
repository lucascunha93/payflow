import { InvalidPaymentError, InvalidTransitionError } from './errors';
import { MAX_AMOUNT_CENTS, NewPaymentInput, Payment } from './payment';

const now = new Date('2026-01-10T12:00:00Z');

function newPayment(overrides: Partial<NewPaymentInput> = {}): Payment {
  return Payment.create({
    id: 'p-1',
    payerId: 'u-1',
    payeeKey: 'loja@example.com',
    amountCents: 15_990,
    currency: 'BRL',
    idempotencyKey: 'key-1',
    now,
    ...overrides,
  });
}

describe('Payment', () => {
  it('starts as PENDING with trimmed fields', () => {
    const snapshot = newPayment({
      payeeKey: '  loja@example.com ',
      description: '  ',
    }).toSnapshot();

    expect(snapshot.status).toBe('PENDING');
    expect(snapshot.payeeKey).toBe('loja@example.com');
    expect(snapshot.description).toBeNull();
    expect(snapshot.createdAt).toEqual(now);
  });

  it.each([0, -1, 10.5, Number.NaN])('rejects amountCents=%p', (amountCents) => {
    expect(() => newPayment({ amountCents })).toThrow(InvalidPaymentError);
  });

  it('rejects amounts above the per-transaction limit', () => {
    expect(() => newPayment({ amountCents: MAX_AMOUNT_CENTS + 1 })).toThrow(InvalidPaymentError);
    expect(() => newPayment({ amountCents: MAX_AMOUNT_CENTS })).not.toThrow();
  });

  it('rejects unsupported currencies and blank payee keys', () => {
    expect(() => newPayment({ currency: 'EUR' })).toThrow(InvalidPaymentError);
    expect(() => newPayment({ payeeKey: '   ' })).toThrow(InvalidPaymentError);
  });

  it('settles a pending payment', () => {
    const payment = newPayment();
    const later = new Date('2026-01-10T12:05:00Z');

    payment.settle(later);

    expect(payment.toSnapshot()).toMatchObject({ status: 'SETTLED', updatedAt: later });
  });

  it('records the reason when failing', () => {
    const payment = newPayment();

    payment.fail('insufficient funds', now);

    expect(payment.toSnapshot()).toMatchObject({
      status: 'FAILED',
      failureReason: 'insufficient funds',
    });
  });

  it('does not allow leaving a final state', () => {
    const payment = newPayment();
    payment.settle(now);

    expect(() => payment.settle(now)).toThrow(InvalidTransitionError);
    expect(() => payment.fail('late', now)).toThrow(InvalidTransitionError);
  });

  it('compares the business payload for idempotent retries', () => {
    const payment = newPayment();
    const same = { payeeKey: 'loja@example.com', amountCents: 15_990, currency: 'BRL' };

    expect(payment.matches(same)).toBe(true);
    expect(payment.matches({ ...same, amountCents: 1 })).toBe(false);
  });
});
