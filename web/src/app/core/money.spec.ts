import { formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it.each([
    ['159,90', 15_990],
    ['159,9', 15_990],
    ['159', 15_900],
    ['0,29', 29],
    ['1.234,56', 123_456],
    ['1.000.000', 100_000_000],
    ['  42,00 ', 4_200],
  ])('reads %s as %i cents', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '10,999', '10.5', '1,234.56', '-5', '1.23,00', '12 34'])(
    'rejects %s',
    (input) => {
      expect(parseAmountToCents(input)).toBeNull();
    },
  );
});

describe('formatCents', () => {
  it('formats in Brazilian notation', () => {
    const nbsp = String.fromCharCode(160);
    expect(formatCents(123_456, 'BRL').replaceAll(nbsp, ' ')).toBe('R$ 1.234,56');
  });
});
