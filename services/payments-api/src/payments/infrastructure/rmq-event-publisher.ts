import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { EventPublisher, PaymentEvent } from '../application/ports';

export const PAYMENT_EVENTS_CLIENT = Symbol('PAYMENT_EVENTS_CLIENT');
const PUBLISH_TIMEOUT_MS = 5_000;

@Injectable()
export class RmqEventPublisher implements EventPublisher {
  constructor(@Inject(PAYMENT_EVENTS_CLIENT) private readonly client: ClientProxy) {}

  async publish(event: PaymentEvent): Promise<void> {
    await lastValueFrom(this.client.emit(event.type, event).pipe(timeout(PUBLISH_TIMEOUT_MS)));
  }
}
