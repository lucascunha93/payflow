import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFICATION_STORE, toNotification } from './notification';
import type { NotificationStore } from './notification';
import { InvalidEventError, parsePaymentEvent } from './payment-event';

export type RecordResult = 'recorded' | 'duplicate' | 'invalid';

/**
 * Turns a payment event into a user notification.
 * RabbitMQ delivers at least once, so the same event may arrive more than once:
 * the store deduplicates on eventId, which makes this handler idempotent.
 */
@Injectable()
export class RecordPaymentEvent {
  private readonly logger = new Logger(RecordPaymentEvent.name);

  constructor(@Inject(NOTIFICATION_STORE) private readonly store: NotificationStore) {}

  async execute(raw: unknown): Promise<RecordResult> {
    let notification;
    try {
      notification = toNotification(parsePaymentEvent(raw));
    } catch (error) {
      if (!(error instanceof InvalidEventError)) throw error;
      // Retrying a malformed message can never succeed, so it is reported and dropped.
      this.logger.warn(`Discarding invalid payment event: ${error.message}`);
      return 'invalid';
    }

    const saved = await this.store.saveIfNew(notification);
    return saved ? 'recorded' : 'duplicate';
  }
}
