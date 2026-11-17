import 'reflect-metadata';
import type { RmqContext } from '@nestjs/microservices';
import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { PaymentEventsConsumer } from './payment-events.consumer';
import type { RecordPaymentEvent, RecordResult } from './record-payment-event';

function setup(execute: () => Promise<RecordResult>) {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { fields: { deliveryTag: 1 } };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
  const consumer = new PaymentEventsConsumer({ execute } as unknown as RecordPaymentEvent);
  return { consumer, channel, message, context };
}

describe('PaymentEventsConsumer', () => {
  it.each<RecordResult>(['recorded', 'duplicate', 'invalid'])(
    'acks the message when the result is %s',
    async (result) => {
      const { consumer, channel, message, context } = setup(async () => result);

      await consumer.onCreated({}, context);

      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.nack).not.toHaveBeenCalled();
    },
  );

  it('registers one handler for each event type', () => {
    const patterns = (['onCreated', 'onSettled', 'onFailed'] as const).flatMap(
      (method) => Reflect.getMetadata(PATTERN_METADATA, PaymentEventsConsumer.prototype[method]) as string[],
    );

    expect(patterns).toEqual(['payment.created', 'payment.settled', 'payment.failed']);
  });

  it('requeues the message when recording fails', async () => {
    const { consumer, channel, message, context } = setup(async () => {
      throw new Error('mongo down');
    });

    await consumer.onCreated({}, context);

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
