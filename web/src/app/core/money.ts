import { Pipe, PipeTransform } from '@angular/core';

/** "1.234,56", "1234,5" or "1234" in pt-BR notation. A dot is only a thousands separator. */
const AMOUNT_PATTERN = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Converts what the user typed into an integer number of cents.
 * The value never goes through floating point, so "0,29" is exactly 29.
 */
export function parseAmountToCents(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1].replaceAll('.', ''));
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCents(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountCents / 100);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amountCents: number, currency: string): string {
    return formatCents(amountCents, currency);
  }
}
