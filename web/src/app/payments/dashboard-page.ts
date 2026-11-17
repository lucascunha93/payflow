import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, combineLatest, merge, startWith, switchMap, tap, timer } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { MoneyPipe } from '../core/money';
import { PaymentForm } from './payment-form';
import { Payment, PaymentStatus, PaymentsService } from './payments.service';

const NOTIFICATIONS_POLL_MS = 5_000;

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendente',
  SETTLED: 'Liquidado',
  FAILED: 'Falhou',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, MoneyPipe, PaymentForm],
  templateUrl: './dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly payments = inject(PaymentsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly refresh$ = new Subject<void>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly filters: { value: PaymentStatus | null; label: string }[] = [
    { value: null, label: 'Todos' },
    { value: 'PENDING', label: 'Pendentes' },
    { value: 'SETTLED', label: 'Liquidados' },
    { value: 'FAILED', label: 'Com falha' },
  ];
  protected readonly statusFilter = signal<PaymentStatus | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyPaymentId = signal<string | null>(null);

  /**
   * Reloads whenever the filter changes or something asks for a refresh.
   * switchMap drops the answer of a superseded request, so a slow response
   * for an old filter can never overwrite the current list.
   */
  protected readonly page = toSignal(
    combineLatest([
      toObservable(this.statusFilter),
      this.refresh$.pipe(startWith(undefined)),
    ]).pipe(
      switchMap(([status]) =>
        this.payments.list(status).pipe(
          tap(() => this.loadFailed.set(false)),
          catchError(() => {
            this.loadFailed.set(true);
            return EMPTY; // keep showing the last list we have
          }),
        ),
      ),
    ),
  );

  /** Notifications are produced asynchronously by another service, so they are polled. */
  protected readonly notifications = toSignal(
    merge(timer(0, NOTIFICATIONS_POLL_MS), this.refresh$).pipe(
      switchMap(() => this.payments.notifications().pipe(catchError(() => EMPTY))),
    ),
    { initialValue: [] },
  );

  protected refresh(): void {
    this.refresh$.next();
  }

  protected settle(payment: Payment): void {
    this.resolve(payment, this.payments.settle(payment.id));
  }

  protected fail(payment: Payment): void {
    this.resolve(payment, this.payments.fail(payment.id, 'Recusado manualmente pelo operador'));
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private resolve(payment: Payment, request: ReturnType<PaymentsService['settle']>): void {
    this.busyPaymentId.set(payment.id);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busyPaymentId.set(null);
        this.refresh();
      },
      error: () => {
        this.busyPaymentId.set(null);
        this.actionError.set('Não foi possível atualizar o pagamento. A lista foi recarregada.');
        this.refresh();
      },
    });
  }
}
