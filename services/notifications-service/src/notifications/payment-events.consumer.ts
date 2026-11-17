import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { RecordPaymentEvent } from './record-payment-event';

interface AckChannel {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
}

@Controller()
export class PaymentEventsConsumer {
  private readonly logger = new Logger(PaymentEventsConsumer.name);

  constructor(private readonly recordPaymentEvent: RecordPaymentEvent) {}

  // One handler per pattern: stacking @EventPattern on a single method registers only one of them.
  @EventPattern<string>('payment.created')
  onCreated(@Payload() payload: unknown, @Ctx() context: RmqContext): Promise<void> {
    return this.handle(payload, context);
  }

  @EventPattern<string>('payment.settled')
  onSettled(@Payload() payload: unknown, @Ctx() context: RmqContext): Promise<void> {
    return this.handle(payload, context);
  }

  @EventPattern<string>('payment.failed')
  onFailed(@Payload() payload: unknown, @Ctx() context: RmqContext): Promise<void> {
    return this.handle(payload, context);
  }

  private async handle(payload: unknown, context: RmqContext): Promise<void> {
    const channel = context.getChannelRef() as AckChannel;
    const message = context.getMessage();
    try {
      await this.recordPaymentEvent.execute(payload);
      // Recorded, duplicate and invalid are all final: nothing to gain from a redelivery.
      channel.ack(message);
    } catch (error) {
      // Transient failure (e.g. MongoDB unavailable): hand it back to the broker.
      this.logger.error('Could not record payment event; requeueing', error);
      channel.nack(message, false, true);
    }
  }
}
