import {
  DuplicateIdempotencyKeyError,
  ListPaymentsFilter,
  Page,
  PaymentRepository,
} from '../application/ports';
import { Payment, PaymentSnapshot } from '../domain/payment';

/** Used by tests; mirrors the constraints enforced by the PostgreSQL schema. */
export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly rows = new Map<string, PaymentSnapshot>();

  async insert(payment: Payment): Promise<void> {
    const snapshot = payment.toSnapshot();
    if (await this.findByIdempotencyKey(snapshot.payerId, snapshot.idempotencyKey)) {
      throw new DuplicateIdempotencyKeyError();
    }
    this.rows.set(snapshot.id, snapshot);
  }

  async update(payment: Payment): Promise<void> {
    this.rows.set(payment.id, payment.toSnapshot());
  }

  async findById(id: string): Promise<Payment | null> {
    const row = this.rows.get(id);
    return row ? Payment.restore(row) : null;
  }

  async findByIdempotencyKey(payerId: string, idempotencyKey: string): Promise<Payment | null> {
    for (const row of this.rows.values()) {
      if (row.payerId === payerId && row.idempotencyKey === idempotencyKey) {
        return Payment.restore(row);
      }
    }
    return null;
  }

  async list(filter: ListPaymentsFilter): Promise<Page<Payment>> {
    const matching = [...this.rows.values()]
      .filter((row) => row.payerId === filter.payerId)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (filter.page - 1) * filter.limit;
    return {
      items: matching.slice(start, start + filter.limit).map((row) => Payment.restore(row)),
      total: matching.length,
      page: filter.page,
      limit: filter.limit,
    };
  }
}
