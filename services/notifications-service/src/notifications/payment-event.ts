export const PAYMENT_EVENT_TYPES = ['payment.created', 'payment.settled', 'payment.failed'] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

/** Contract published by payments-api on the payments.events queue. */
export interface PaymentEvent {
  eventId: string;
  type: PaymentEventType;
  occurredAt: string;
  data: {
    paymentId: string;
    payerId: string;
    payeeKey: string;
    amountCents: number;
    currency: string;
    failureReason: string | null;
  };
}

export class InvalidEventError extends Error {}

/**
 * Messages come from another service, so the shape is checked before use
 * instead of trusting the TypeScript type.
 */
export function parsePaymentEvent(raw: unknown): PaymentEvent {
  const event = asRecord(raw, 'event');
  const data = asRecord(event.data, 'data');
  const type = asString(event.type, 'type');
  if (!(PAYMENT_EVENT_TYPES as readonly string[]).includes(type)) {
    throw new InvalidEventError(`unknown event type ${type}`);
  }
  const occurredAt = asString(event.occurredAt, 'occurredAt');
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new InvalidEventError('occurredAt is not a valid date');
  }
  if (typeof data.amountCents !== 'number' || !Number.isInteger(data.amountCents)) {
    throw new InvalidEventError('data.amountCents must be an integer');
  }

  return {
    eventId: asString(event.eventId, 'eventId'),
    type: type as PaymentEventType,
    occurredAt,
    data: {
      paymentId: asString(data.paymentId, 'data.paymentId'),
      payerId: asString(data.payerId, 'data.payerId'),
      payeeKey: asString(data.payeeKey, 'data.payeeKey'),
      amountCents: data.amountCents,
      currency: asString(data.currency, 'data.currency'),
      failureReason: typeof data.failureReason === 'string' ? data.failureReason : null,
    },
  };
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidEventError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new InvalidEventError(`${field} must be a non-empty string`);
  }
  return value;
}
