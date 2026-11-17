import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  IdempotencyConflictError,
  InvalidPaymentError,
  InvalidTransitionError,
  PaymentNotFoundError,
} from '../domain/errors';

/** Translates domain errors into HTTP responses, keeping the domain free of HTTP concerns. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const statusCode = statusFor(error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, error: error.name, message: error.message });
  }
}

function statusFor(error: DomainError): number {
  if (error instanceof PaymentNotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof InvalidPaymentError) return HttpStatus.UNPROCESSABLE_ENTITY;
  if (error instanceof InvalidTransitionError) return HttpStatus.CONFLICT;
  if (error instanceof IdempotencyConflictError) return HttpStatus.CONFLICT;
  return HttpStatus.BAD_REQUEST;
}
