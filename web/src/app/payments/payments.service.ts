import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type PaymentStatus = 'PENDING' | 'SETTLED' | 'FAILED';

export interface Payment {
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

export interface PaymentPage {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
}

export interface NewPayment {
  payeeKey: string;
  amountCents: number;
  currency: string;
  description?: string;
}

export interface PaymentNotification {
  id: string;
  type: string;
  paymentId: string;
  message: string;
  occurredAt: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);

  list(status: PaymentStatus | null): Observable<PaymentPage> {
    let params = new HttpParams().set('limit', 50);
    if (status) params = params.set('status', status);
    return this.http.get<PaymentPage>('/api/payments', { params });
  }

  /** The same idempotencyKey must be sent again when retrying the same payment. */
  create(payment: NewPayment, idempotencyKey: string): Observable<Payment> {
    return this.http.post<Payment>('/api/payments', payment, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  settle(id: string): Observable<Payment> {
    return this.http.post<Payment>(`/api/payments/${id}/settle`, {});
  }

  fail(id: string, reason: string): Observable<Payment> {
    return this.http.post<Payment>(`/api/payments/${id}/fail`, { reason });
  }

  notifications(): Observable<PaymentNotification[]> {
    return this.http.get<PaymentNotification[]>('/api/notifications');
  }
}
