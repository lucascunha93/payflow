import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1760000000000 implements MigrationInterface {
  name = 'CreatePayments1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payments (
        id uuid PRIMARY KEY,
        payer_id varchar(64) NOT NULL,
        payee_key varchar(140) NOT NULL,
        amount_cents integer NOT NULL CHECK (amount_cents > 0),
        currency char(3) NOT NULL,
        description varchar(140),
        status varchar(16) NOT NULL CHECK (status IN ('PENDING', 'SETTLED', 'FAILED')),
        failure_reason varchar(255),
        idempotency_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_payments_payer_idempotency ON payments (payer_id, idempotency_key)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_payments_payer_created ON payments (payer_id, created_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payments`);
  }
}
