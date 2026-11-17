import { Inject, Injectable, Logger } from '@nestjs/common';
import { IdempotencyConflictError } from '../domain/errors';
import { Payment } from '../domain/payment';
import { toPaymentEvent } from './payment-events';
import { DuplicateIdempotencyKeyError, PAYMENT_REPOSITORY, EVENT_PUBLISHER, CLOCK, ID_GENERATOR } from './ports';
import type { Clock, EventPublisher, IdGenerator, PaymentRepository } from './ports';

export interface CreatePaymentCommand {
  payerId: string;
  payeeKey: string;
  amountCents: number;
  currency: string;
  description?: string | null;
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  payment: Payment;
  /** False when the request was a retry and the stored payment was returned. */
  created: boolean;
}

@Injectable()
export class CreatePaymentUseCase {
  private readonly logger = new Logger(CreatePaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    const existing = await this.payments.findByIdempotencyKey(
      command.payerId,
      command.idempotencyKey,
    );
    if (existing) {
      return this.replay(existing, command);
    }

    const now = this.clock.now();
    const payment = Payment.create({ ...command, id: this.ids.next(), now });

    try {
      await this.payments.insert(payment);
    } catch (error) {
      if (!(error instanceof DuplicateIdempotencyKeyError)) throw error;
      // Two requests with the same key raced; the unique index picked a winner.
      const winner = await this.payments.findByIdempotencyKey(
        command.payerId,
        command.idempotencyKey,
      );
      if (!winner) throw error;
      return this.replay(winner, command);
    }

    await this.publishCreated(payment, now);
    return { payment, created: true };
  }

  private replay(existing: Payment, command: CreatePaymentCommand): CreatePaymentResult {
    if (!existing.matches(command)) {
      throw new IdempotencyConflictError();
    }
    return { payment: existing, created: false };
  }

  private async publishCreated(payment: Payment, now: Date): Promise<void> {
    try {
      await this.events.publish(toPaymentEvent('payment.created', payment, this.ids.next(), now));
    } catch (error) {
      // The payment is already committed, so the request still succeeds.
      // A transactional outbox would close this gap (see README, "Limitações conhecidas").
      this.logger.error(`payment.created for ${payment.id} was not published`, error);
    }
  }
}
