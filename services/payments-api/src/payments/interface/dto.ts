import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_AMOUNT_CENTS, PAYMENT_STATUSES, SUPPORTED_CURRENCIES } from '../domain/payment';
import type { Payment, PaymentStatus } from '../domain/payment';
import type { Page } from '../application/ports';

export class CreatePaymentDto {
  @ApiProperty({ example: 'loja@example.com', description: 'Chave do recebedor (ex.: chave Pix)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  payeeKey!: string;

  @ApiProperty({ example: 15990, description: 'Valor em centavos' })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  amountCents!: number;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'BRL' })
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;

  @ApiPropertyOptional({ example: 'Pedido #1042' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  description?: string;
}

export class FailPaymentDto {
  @ApiProperty({ example: 'Saldo insuficiente' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface PaymentResponse {
  id: string;
  payeeKey: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPaymentResponse(payment: Payment): PaymentResponse {
  const snapshot = payment.toSnapshot();
  return {
    id: snapshot.id,
    payeeKey: snapshot.payeeKey,
    amountCents: snapshot.amountCents,
    currency: snapshot.currency,
    description: snapshot.description,
    status: snapshot.status,
    failureReason: snapshot.failureReason,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toPageResponse(page: Page<Payment>): Page<PaymentResponse> {
  return { ...page, items: page.items.map(toPaymentResponse) };
}
