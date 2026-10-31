import { Prisma } from '@brightloop/database';

/**
 * Standard money precision and rounding helpers.
 * Rule: Zero floating point math. NUMERIC(14,2) with round half-up.
 */

export const toDecimal = (val: number | string | Prisma.Decimal): Prisma.Decimal => {
  if (val instanceof Prisma.Decimal) {
    return val;
  }
  return new Prisma.Decimal(val);
};

export const roundMoney = (val: Prisma.Decimal): Prisma.Decimal => {
  // Prisma.Decimal uses Decimal.js under the hood; ROUND_HALF_UP is mode 4
  return val.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
};

export const formatMoney = (val: Prisma.Decimal | number | string): string => {
  return toDecimal(val).toFixed(2);
};

export const addMoney = (
  a: Prisma.Decimal | number | string,
  b: Prisma.Decimal | number | string,
): Prisma.Decimal => {
  return roundMoney(toDecimal(a).plus(toDecimal(b)));
};

export const multiplyMoney = (
  unitPrice: Prisma.Decimal | number | string,
  quantity: number,
): Prisma.Decimal => {
  return roundMoney(toDecimal(unitPrice).times(quantity));
};
