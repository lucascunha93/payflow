import { Inject, Injectable } from '@nestjs/common';
import { PaymentNotFoundError } from '../domain/errors';
import { Payment } from '../domain/payment';
import { PAYMENT_REPOSITORY } from './ports';
import type { ListPaymentsFilter, Page, PaymentRepository } from './ports';

@Injectable()
export class PaymentQueries {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository) {}

  /** A payment that belongs to someone else is reported as missing, not forbidden. */
  async getOwned(paymentId: string, payerId: string): Promise<Payment> {
    const payment = await this.payments.findById(paymentId);
    if (!payment || payment.payerId !== payerId) {
      throw new PaymentNotFoundError(paymentId);
    }
    return payment;
  }

  list(filter: ListPaymentsFilter): Promise<Page<Payment>> {
    return this.payments.list(filter);
  }
}
