import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentForm } from './payment-form';
import { Payment } from './payments.service';

const createdPayment: Payment = {
  id: 'pay-1',
  payeeKey: 'loja@example.com',
  amountCents: 15_990,
  currency: 'BRL',
  description: null,
  status: 'PENDING',
  failureReason: null,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

describe('PaymentForm', () => {
  let fixture: ComponentFixture<PaymentForm>;
  let backend: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentForm);
    backend = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  async function type(id: string, value: string): Promise<void> {
    const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows validation messages instead of calling the API', async () => {
    await type('amount', '10.5');
    await submit();

    expect(element.querySelectorAll('.field-error')).toHaveLength(2);
    backend.expectNone('/api/payments');
  });

  it('sends the amount in cents with an idempotency key', async () => {
    const created: Payment[] = [];
    fixture.componentInstance.created.subscribe((payment) => created.push(payment));
    await type('payeeKey', ' loja@example.com ');
    await type('amount', '159,90');
    await submit();

    const request = backend.expectOne('/api/payments');
    expect(request.request.body).toEqual({
      payeeKey: 'loja@example.com',
      amountCents: 15_990,
      currency: 'BRL',
    });
    expect(request.request.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,128}$/);

    request.flush(createdPayment);
    await fixture.whenStable();
    expect(created).toEqual([createdPayment]);
    expect(element.querySelector<HTMLInputElement>('#amount')!.value).toBe('');
  });

  it('reuses the idempotency key when the same payment is retried', async () => {
    await type('payeeKey', 'loja@example.com');
    await type('amount', '159,90');
    await submit();
    const first = backend.expectOne('/api/payments');
    first.error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('não será duplicado');
    await submit();

    const retry = backend.expectOne('/api/payments');
    expect(retry.request.headers.get('Idempotency-Key')).toBe(
      first.request.headers.get('Idempotency-Key'),
    );
    retry.flush(createdPayment);
  });

  it('uses a new idempotency key after the form is edited', async () => {
    await type('payeeKey', 'loja@example.com');
    await type('amount', '159,90');
    await submit();
    const first = backend.expectOne('/api/payments');
    first.error(new ProgressEvent('error'));
    await fixture.whenStable();

    await type('amount', '200,00');
    await submit();

    const second = backend.expectOne('/api/payments');
    expect(second.request.headers.get('Idempotency-Key')).not.toBe(
      first.request.headers.get('Idempotency-Key'),
    );
    second.flush(createdPayment);
  });
});
