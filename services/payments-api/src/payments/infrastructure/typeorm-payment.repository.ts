import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  DuplicateIdempotencyKeyError,
  ListPaymentsFilter,
  Page,
  PaymentRepository,
} from '../application/ports';
import { Currency, Payment, PaymentStatus } from '../domain/payment';
import { PaymentOrmEntity } from './payment.orm-entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(
    @InjectRepository(PaymentOrmEntity) private readonly rows: Repository<PaymentOrmEntity>,
  ) {}

  async insert(payment: Payment): Promise<void> {
    try {
      await this.rows.insert(payment.toSnapshot());
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateIdempotencyKeyError();
      throw error;
    }
  }

  async update(payment: Payment): Promise<void> {
    const { id, status, failureReason, updatedAt } = payment.toSnapshot();
    await this.rows.update({ id }, { status, failureReason, updatedAt });
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.rows.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findByIdempotencyKey(payerId: string, idempotencyKey: string): Promise<Payment | null> {
    const row = await this.rows.findOneBy({ payerId, idempotencyKey });
    return row ? toDomain(row) : null;
  }

  async list(filter: ListPaymentsFilter): Promise<Page<Payment>> {
    const [rows, total] = await this.rows.findAndCount({
      where: { payerId: filter.payerId, ...(filter.status ? { status: filter.status } : {}) },
      order: { createdAt: 'DESC' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    });
    return { items: rows.map(toDomain), total, page: filter.page, limit: filter.limit };
  }
}

function toDomain(row: PaymentOrmEntity): Payment {
  return Payment.restore({
    id: row.id,
    payerId: row.payerId,
    payeeKey: row.payeeKey,
    amountCents: row.amountCents,
    currency: row.currency as Currency,
    description: row.description,
    status: row.status as PaymentStatus,
    failureReason: row.failureReason,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION
  );
}
