import type { Notification, NotificationStore } from './notification';
import { RecordPaymentEvent } from './record-payment-event';

class InMemoryStore implements NotificationStore {
  readonly saved: Notification[] = [];

  async saveIfNew(notification: Notification): Promise<boolean> {
    if (this.saved.some((item) => item.eventId === notification.eventId)) return false;
    this.saved.push(notification);
    return true;
  }

  async listForUser(userId: string, limit: number): Promise<Notification[]> {
    return this.saved.filter((item) => item.userId === userId).slice(0, limit);
  }
}

const event = {
  eventId: 'evt-1',
  type: 'payment.created',
  occurredAt: '2026-01-10T12:00:00.000Z',
  data: {
    paymentId: 'pay-1',
    payerId: 'usr_demo',
    payeeKey: 'loja@example.com',
    amountCents: 15_990,
    currency: 'BRL',
    status: 'PENDING',
    failureReason: null,
  },
};

/** Intl separates the currency symbol with a non-breaking space. */
const NBSP = String.fromCharCode(160);
const normalize = (text: string) => text.replaceAll(NBSP, " ");

describe('RecordPaymentEvent', () => {
  let store: InMemoryStore;
  let useCase: RecordPaymentEvent;

  beforeEach(() => {
    store = new InMemoryStore();
    useCase = new RecordPaymentEvent(store);
  });

  it('records a notification for the payer', async () => {
    expect(await useCase.execute(event)).toBe('recorded');

    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]).toMatchObject({
      eventId: 'evt-1',
      type: 'payment.created',
      userId: 'usr_demo',
      paymentId: 'pay-1',
      occurredAt: new Date('2026-01-10T12:00:00.000Z'),
    });
    expect(normalize(store.saved[0].message)).toBe(
      'Pagamento de R$ 159,90 para loja@example.com foi criado e aguarda liquidação.',
    );
  });

  it('ignores a redelivered event', async () => {
    await useCase.execute(event);

    expect(await useCase.execute(event)).toBe('duplicate');
    expect(store.saved).toHaveLength(1);
  });

  it('includes the reason for failed payments', async () => {
    await useCase.execute({
      ...event,
      type: 'payment.failed',
      data: { ...event.data, failureReason: 'Saldo insuficiente' },
    });

    expect(normalize(store.saved[0].message)).toBe(
      'Pagamento de R$ 159,90 para loja@example.com falhou: Saldo insuficiente.',
    );
  });

  it.each([
    ['a non-object payload', 'not-json'],
    ['a missing eventId', { ...event, eventId: undefined }],
    ['an unknown type', { ...event, type: 'payment.refunded' }],
    ['an invalid date', { ...event, occurredAt: 'yesterday' }],
    ['a fractional amount', { ...event, data: { ...event.data, amountCents: 10.5 } }],
    ['missing data', { ...event, data: null }],
  ])('discards %s without storing anything', async (_label, payload) => {
    expect(await useCase.execute(payload)).toBe('invalid');
    expect(store.saved).toHaveLength(0);
  });

  it('lets storage failures propagate so the message can be retried', async () => {
    jest.spyOn(store, 'saveIfNew').mockRejectedValue(new Error('mongo down'));

    await expect(useCase.execute(event)).rejects.toThrow('mongo down');
  });
});
