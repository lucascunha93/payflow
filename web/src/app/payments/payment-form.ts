import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { formatCents, parseAmountToCents } from '../core/money';
import { Payment, PaymentsService } from './payments.service';

/** Mirrors the per-transaction limit enforced by the API. */
const MAX_AMOUNT_CENTS = 10_000_000;

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value.trim()) return null; // "required" reports the empty case
  const cents = parseAmountToCents(control.value);
  if (cents === null || cents <= 0) return { amount: true };
  return cents > MAX_AMOUNT_CENTS ? { amountLimit: true } : null;
}

@Component({
  selector: 'app-payment-form',
  imports: [ReactiveFormsModule],
  templateUrl: './payment-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentForm {
  private readonly payments = inject(PaymentsService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly created = output<Payment>();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly limitLabel = formatCents(MAX_AMOUNT_CENTS, 'BRL');

  protected readonly form = this.formBuilder.group({
    payeeKey: ['', [Validators.required, Validators.maxLength(140)]],
    amount: ['', [Validators.required, amountValidator]],
    currency: ['BRL', Validators.required],
    description: ['', Validators.maxLength(140)],
  });

  /**
   * One key per payment the user intends to make. It survives a failed submit,
   * so pressing "Enviar" again after a timeout cannot create a second payment,
   * and it is replaced as soon as the user edits the form.
   */
  private idempotencyKey = crypto.randomUUID();

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.idempotencyKey = crypto.randomUUID();
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const { payeeKey, amount, currency, description } = this.form.getRawValue();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.payments
      .create(
        {
          payeeKey: payeeKey.trim(),
          amountCents,
          currency,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (payment) => {
          this.form.reset(); // also rotates the idempotency key through valueChanges
          this.created.emit(payment);
        },
        error: (error: unknown) => this.errorMessage.set(describeError(error)),
      });
  }

  protected showError(name: 'payeeKey' | 'amount' | 'description'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }
}

function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'Sem conexão com o servidor. Você pode tentar de novo: o pagamento não será duplicado.';
  }
  if (error instanceof HttpErrorResponse && error.status < 500) {
    return 'O pagamento foi recusado. Revise os dados e tente novamente.';
  }
  return 'Não foi possível criar o pagamento agora. Tente novamente: ele não será duplicado.';
}
