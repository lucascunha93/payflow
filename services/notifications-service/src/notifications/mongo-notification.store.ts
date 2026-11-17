import { Injectable } from '@nestjs/common';
import { InjectModel, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Notification, NotificationStore } from './notification';
import type { PaymentEventType } from './payment-event';

const MONGO_DUPLICATE_KEY = 11000;

@Schema({ collection: 'notifications', timestamps: { createdAt: true, updatedAt: false } })
export class NotificationDocument {
  @Prop({ type: String, required: true, unique: true })
  eventId!: string;

  @Prop({ type: String, required: true })
  type!: PaymentEventType;

  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true })
  paymentId!: string;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(NotificationDocument);
NotificationSchema.index({ userId: 1, occurredAt: -1 });

@Injectable()
export class MongoNotificationStore implements NotificationStore {
  constructor(
    @InjectModel(NotificationDocument.name)
    private readonly model: Model<NotificationDocument>,
  ) {}

  async saveIfNew(notification: Notification): Promise<boolean> {
    try {
      await this.model.create(notification);
      return true;
    } catch (error) {
      // The unique index on eventId is what makes redeliveries harmless.
      if ((error as { code?: number }).code === MONGO_DUPLICATE_KEY) return false;
      throw error;
    }
  }

  async listForUser(userId: string, limit: number): Promise<Notification[]> {
    const documents = await this.model
      .find({ userId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return documents.map((document) => ({
      eventId: document.eventId,
      type: document.type,
      userId: document.userId,
      paymentId: document.paymentId,
      message: document.message,
      occurredAt: document.occurredAt,
    }));
  }
}
