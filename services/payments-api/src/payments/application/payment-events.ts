import { Payment } from '../domain/payment';
import { PaymentEvent, PaymentEventType } from './ports';

export function toPaymentEvent(
  type: PaymentEventType,
  payment: Payment,
  eventId: string,
  occurredAt: Date,
): PaymentEvent {
  const snapshot = payment.toSnapshot();
  return {
    eventId,
    type,
    occurredAt: occurredAt.toISOString(),
    data: {
      paymentId: snapshot.id,
      payerId: snapshot.payerId,
      payeeKey: snapshot.payeeKey,
      amountCents: snapshot.amountCents,
      currency: snapshot.currency,
      status: snapshot.status,
      failureReason: snapshot.failureReason,
    },
  };
}
