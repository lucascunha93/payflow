import { InvalidPaymentError, InvalidTransitionError } from './errors';

export const PAYMENT_STATUSES = ['PENDING', 'SETTLED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUPPORTED_CURRENCIES = ['BRL', 'USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Per-transaction ceiling, in cents (R$ 100.000,00). */
export const MAX_AMOUNT_CENTS = 10_000_000;

export interface PaymentSnapshot {
  id: string;
  payerId: string;
  payeeKey: string;
  amountCents: number;
  currency: Currency;
  description: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPaymentInput {
  id: string;
  payerId: string;
  payeeKey: string;
  amountCents: number;
  currency: string;
  description?: string | null;
  idempotencyKey: string;
  now: Date;
}

/**
 * Payment aggregate. Money is always an integer amount of cents:
 * floating point is never used for monetary values.
 */
export class Payment {
  private constructor(private props: PaymentSnapshot) {}

  static create(input: NewPaymentInput): Payment {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new InvalidPaymentError('amountCents must be a positive integer');
    }
    if (input.amountCents > MAX_AMOUNT_CENTS) {
      throw new InvalidPaymentError(
        `amountCents exceeds the per-transaction limit of ${MAX_AMOUNT_CENTS}`,
      );
    }
    if (!isSupportedCurrency(input.currency)) {
      throw new InvalidPaymentError(`currency ${input.currency} is not supported`);
    }
    const payeeKey = input.payeeKey.trim();
    if (!payeeKey) {
      throw new InvalidPaymentError('payeeKey is required');
    }

    return new Payment({
      id: input.id,
      payerId: input.payerId,
      payeeKey,
      amountCents: input.amountCents,
      currency: input.currency,
      description: input.description?.trim() || null,
      status: 'PENDING',
      failureReason: null,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(snapshot: PaymentSnapshot): Payment {
    return new Payment({ ...snapshot });
  }

  get id(): string {
    return this.props.id;
  }

  get payerId(): string {
    return this.props.payerId;
  }

  get status(): PaymentStatus {
    return this.props.status;
  }

  settle(now: Date): void {
    this.assertPending('SETTLED');
    this.props.status = 'SETTLED';
    this.props.updatedAt = now;
  }

  fail(reason: string, now: Date): void {
    this.assertPending('FAILED');
    this.props.status = 'FAILED';
    this.props.failureReason = reason;
    this.props.updatedAt = now;
  }

  /** True when a retried request carries the same business payload. */
  matches(input: Pick<NewPaymentInput, 'payeeKey' | 'amountCents' | 'currency'>): boolean {
    return (
      this.props.payeeKey === input.payeeKey.trim() &&
      this.props.amountCents === input.amountCents &&
      this.props.currency === input.currency
    );
  }

  toSnapshot(): PaymentSnapshot {
    return { ...this.props };
  }

  private assertPending(target: PaymentStatus): void {
    if (this.props.status !== 'PENDING') {
      throw new InvalidTransitionError(this.props.status, target);
    }
  }
}

function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}
