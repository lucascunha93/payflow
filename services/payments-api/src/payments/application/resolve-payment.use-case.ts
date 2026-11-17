import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentNotFoundError } from '../domain/errors';
import { Payment } from '../domain/payment';
import { toPaymentEvent } from './payment-events';
import { CLOCK, EVENT_PUBLISHER, ID_GENERATOR, PAYMENT_REPOSITORY } from './ports';
import type { Clock, EventPublisher, IdGenerator, PaymentRepository } from './ports';

export type PaymentOutcome = { result: 'SETTLED' } | { result: 'FAILED'; reason: string };

export interface ResolvePaymentCommand {
  paymentId: string;
  payerId: string;
  outcome: PaymentOutcome;
}

/** Moves a pending payment to its final state and announces it. */
@Injectable()
export class ResolvePaymentUseCase {
  private readonly logger = new Logger(ResolvePaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: ResolvePaymentCommand): Promise<Payment> {
    const payment = await this.payments.findById(command.paymentId);
    if (!payment || payment.payerId !== command.payerId) {
      throw new PaymentNotFoundError(command.paymentId);
    }

    const now = this.clock.now();
    if (command.outcome.result === 'SETTLED') {
      payment.settle(now);
    } else {
      payment.fail(command.outcome.reason, now);
    }
    await this.payments.update(payment);

    const type = command.outcome.result === 'SETTLED' ? 'payment.settled' : 'payment.failed';
    try {
      await this.events.publish(toPaymentEvent(type, payment, this.ids.next(), now));
    } catch (error) {
      this.logger.error(`${type} for ${payment.id} was not published`, error);
    }
    return payment;
  }
}
