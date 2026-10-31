import { BillingFrequency } from '@brightloop/shared';

/**
 * Standard date & billing period calculation utilities.
 * Handles deterministic interval boundaries for DAILY, WEEKLY, MONTHLY, and YEARLY cycles.
 */

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  // Handle overflow (e.g., Jan 31 + 1 month -> March 3 -> clamp to Feb 28/29)
  if (result.getMonth() !== expectedMonth && result.getMonth() !== (expectedMonth + 12) % 12) {
    result.setDate(0);
  }
  return result;
};

export const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

export interface BillingPeriod {
  periodStartDate: Date;
  periodEndDate: Date;
  nextBillingDate: Date;
}

export const computeBillingPeriod = (
  periodStart: Date,
  frequency: BillingFrequency,
): BillingPeriod => {
  const start = new Date(periodStart);
  let nextCycleDate: Date;

  switch (frequency) {
    case 'DAILY':
      nextCycleDate = addDays(start, 1);
      break;
    case 'WEEKLY':
      nextCycleDate = addDays(start, 7);
      break;
    case 'MONTHLY':
      nextCycleDate = addMonths(start, 1);
      break;
    case 'YEARLY':
      nextCycleDate = addYears(start, 1);
      break;
    default:
      nextCycleDate = addMonths(start, 1);
  }

  // periodEndDate is 1 millisecond before nextCycleDate
  const periodEndDate = new Date(nextCycleDate.getTime() - 1);

  return {
    periodStartDate: start,
    periodEndDate,
    nextBillingDate: nextCycleDate,
  };
};
