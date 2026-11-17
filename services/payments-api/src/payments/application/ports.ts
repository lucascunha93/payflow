import { Payment, PaymentStatus } from '../domain/payment';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListPaymentsFilter {
  payerId: string;
  status?: PaymentStatus;
  page: number;
  limit: number;
}

/** Raised by repositories when (payerId, idempotencyKey) already exists. */
export class DuplicateIdempotencyKeyError extends Error {}

export interface PaymentRepository {
  /** @throws DuplicateIdempotencyKeyError */
  insert(payment: Payment): Promise<void>;
  update(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(payerId: string, idempotencyKey: string): Promise<Payment | null>;
  list(filter: ListPaymentsFilter): Promise<Page<Payment>>;
}

export type PaymentEventType = 'payment.created' | 'payment.settled' | 'payment.failed';

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
    status: PaymentStatus;
    failureReason: string | null;
  };
}

export interface EventPublisher {
  publish(event: PaymentEvent): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
