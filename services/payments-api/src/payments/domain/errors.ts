export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidPaymentError extends DomainError {}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`payment cannot go from ${from} to ${to}`);
  }
}

export class PaymentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`payment ${id} not found`);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor() {
    super('Idempotency-Key was already used with a different payload');
  }
}
