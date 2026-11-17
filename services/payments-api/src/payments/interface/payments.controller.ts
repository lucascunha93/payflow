import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreatePaymentUseCase } from '../application/create-payment.use-case';
import { PaymentQueries } from '../application/payment-queries';
import type { Page } from '../application/ports';
import { ResolvePaymentUseCase } from '../application/resolve-payment.use-case';
import {
  CreatePaymentDto,
  FailPaymentDto,
  ListPaymentsQueryDto,
  toPageResponse,
  toPaymentResponse,
} from './dto';
import type { PaymentResponse } from './dto';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly createPayment: CreatePaymentUseCase,
    private readonly resolvePayment: ResolvePaymentUseCase,
    private readonly queries: PaymentQueries,
  ) {}

  /** Returns 201 for a new payment and 200 when the same Idempotency-Key is replayed. */
  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '8 a 128 caracteres' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PaymentResponse> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'Idempotency-Key header is required (8-128 chars: letters, digits, "-" or "_")',
      );
    }

    const { payment, created } = await this.createPayment.execute({
      payerId: user.id,
      idempotencyKey,
      payeeKey: body.payeeKey,
      amountCents: body.amountCents,
      currency: body.currency,
      description: body.description,
    });
    response.status(created ? 201 : 200);
    return toPaymentResponse(payment);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<Page<PaymentResponse>> {
    return toPageResponse(await this.queries.list({ payerId: user.id, ...query }));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    return toPaymentResponse(await this.queries.getOwned(id, user.id));
  }

  @Post(':id/settle')
  @HttpCode(200)
  async settle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.resolvePayment.execute({
      paymentId: id,
      payerId: user.id,
      outcome: { result: 'SETTLED' },
    });
    return toPaymentResponse(payment);
  }

  @Post(':id/fail')
  @HttpCode(200)
  async fail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FailPaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.resolvePayment.execute({
      paymentId: id,
      payerId: user.id,
      outcome: { result: 'FAILED', reason: body.reason },
    });
    return toPaymentResponse(payment);
  }
}
