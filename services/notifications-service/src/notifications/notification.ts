import type { PaymentEvent, PaymentEventType } from './payment-event';

export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');

export interface Notification {
  eventId: string;
  type: PaymentEventType;
  userId: string;
  paymentId: string;
  message: string;
  occurredAt: Date;
}

export interface NotificationStore {
  /** Returns false when the event was already recorded (duplicate delivery). */
  saveIfNew(notification: Notification): Promise<boolean>;
  listForUser(userId: string, limit: number): Promise<Notification[]>;
}

export function toNotification(event: PaymentEvent): Notification {
  return {
    eventId: event.eventId,
    type: event.type,
    userId: event.data.payerId,
    paymentId: event.data.paymentId,
    message: describe(event),
    occurredAt: new Date(event.occurredAt),
  };
}

function describe({ type, data }: PaymentEvent): string {
  const amount = formatMoney(data.amountCents, data.currency);
  switch (type) {
    case 'payment.created':
      return `Pagamento de ${amount} para ${data.payeeKey} foi criado e aguarda liquidação.`;
    case 'payment.settled':
      return `Pagamento de ${amount} para ${data.payeeKey} foi liquidado.`;
    case 'payment.failed':
      return `Pagamento de ${amount} para ${data.payeeKey} falhou: ${data.failureReason ?? 'motivo não informado'}.`;
  }
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(
      amountCents / 100,
    );
  } catch {
    // Unknown currency code: fall back to a plain rendering instead of dropping the event.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
