import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { CurrentUserId, JwtAuthGuard } from '../jwt-auth.guard';
import { NOTIFICATION_STORE } from './notification';
import type { NotificationStore } from './notification';

const FEED_SIZE = 50;

export interface NotificationResponse {
  id: string;
  type: string;
  paymentId: string;
  message: string;
  occurredAt: string;
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NOTIFICATION_STORE) private readonly store: NotificationStore) {}

  /** Latest notifications of the authenticated user, newest first. */
  @Get()
  async list(@CurrentUserId() userId: string): Promise<NotificationResponse[]> {
    const notifications = await this.store.listForUser(userId, FEED_SIZE);
    return notifications.map((notification) => ({
      id: notification.eventId,
      type: notification.type,
      paymentId: notification.paymentId,
      message: notification.message,
      occurredAt: notification.occurredAt.toISOString(),
    }));
  }
}
