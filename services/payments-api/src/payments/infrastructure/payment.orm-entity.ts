import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'payments' })
@Index('uq_payments_payer_idempotency', ['payerId', 'idempotencyKey'], { unique: true })
@Index('ix_payments_payer_created', ['payerId', 'createdAt'])
export class PaymentOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'payer_id', type: 'varchar', length: 64 })
  payerId!: string;

  @Column({ name: 'payee_key', type: 'varchar', length: 140 })
  payeeKey!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 140, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
