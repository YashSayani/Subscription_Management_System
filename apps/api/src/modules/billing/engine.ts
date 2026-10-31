import {
  prisma,
  Prisma,
  InvoiceStatus,
  BillingAttemptStatus,
} from '@brightloop/database';
import { logger } from '../../common/logger.js';
import { roundMoney } from '../../common/money.js';
import { computeBillingPeriod, addDays } from '../../common/dates.js';
import { DiscountService } from '../discounts/service.js';

export interface BillingCycleResult {
  processed: number;
  successful: number;
  failed: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    subscriptionNumber: string;
    totalAmount: string;
  }>;
  errors: Array<{
    subscriptionId: string;
    error: string;
  }>;
}

export class BillingEngine {
  /**
   * Executes one billing sweep using SELECT FOR UPDATE SKIP LOCKED
   * Safe for concurrent worker processes; ensures idempotent non-duplicate billing.
   */
  static async runBillingCycle(batchSize = 25): Promise<BillingCycleResult> {
    const result: BillingCycleResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      invoices: [],
      errors: [],
    };

    // 1. Concurrently safe selection of due subscriptions
    const dueSubscriptions = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM subscriptions
      WHERE status = 'ACTIVE'::"SubscriptionStatus"
        AND next_billing_date <= NOW()
      ORDER BY next_billing_date ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    result.processed = dueSubscriptions.length;
    if (dueSubscriptions.length === 0) {
      return result;
    }

    logger.info(
      `[BillingEngine] Picked up ${dueSubscriptions.length} due subscriptions for processing`,
    );

    // 2. Process each subscription in an isolated transaction
    for (const item of dueSubscriptions) {
      try {
        const generated = await prisma.$transaction(async (tx) => {
          const subscription = await tx.subscription.findUnique({
            where: { id: item.id },
            include: {
              plan: true,
              customer: true,
              lines: {
                include: { product: true, variant: true },
              },
            },
          });

          if (
            !subscription ||
            subscription.status !== 'ACTIVE' ||
            !subscription.nextBillingDate
          ) {
            return null;
          }

          const periodStartDate = subscription.nextBillingDate;
          const { periodEndDate, nextBillingDate: nextCycleBillingDate } =
            computeBillingPeriod(periodStartDate, subscription.plan.billingFrequency);

          const dueDate = addDays(periodStartDate, subscription.paymentTermsDays);

          // Idempotency check: verify composite unique (subscriptionId, periodStartDate)
          const existingInvoice = await tx.invoice.findUnique({
            where: {
              unique_subscription_period: {
                subscriptionId: subscription.id,
                periodStartDate,
              },
            },
          });

          if (existingInvoice) {
            logger.warn(
              `[BillingEngine] Invoice already exists for sub ${subscription.subscriptionNumber} at ${periodStartDate.toISOString()}. Advancing cycle.`,
            );
            await tx.subscription.update({
              where: { id: subscription.id },
              data: { nextBillingDate: nextCycleBillingDate },
            });
            return null;
          }

          // Sequence invoice number: INV-YYYY-XXXXX
          const [seqRes] = await tx.$queryRaw<[{ num: string }]>`SELECT generate_invoice_number() as num`;
          const invoiceNumber = seqRes.num;

          // Build line items from subscription snapshot lines
          const invoiceLines = subscription.lines.map((subLine) => {
            const variantDesc = subLine.variant
              ? ` (${subLine.variant.attributeName}: ${subLine.variant.attributeValue})`
              : '';
            const description = `${subLine.product.name}${variantDesc}`;

            return {
              productId: subLine.productId,
              variantId: subLine.variantId,
              description,
              quantity: subLine.quantity,
              unitPrice: subLine.unitPrice,
              variantAdjustment: subLine.variantAdjustment,
              taxRate: subLine.taxRate,
              subtotal: subLine.subtotal,
              taxAmount: subLine.taxAmount,
              totalAmount: subLine.totalAmount,
            };
          });

          // Calculate invoice aggregates
          const subtotal = invoiceLines.reduce(
            (acc, l) => acc.plus(l.subtotal),
            new Prisma.Decimal(0),
          );
          const taxAmount = invoiceLines.reduce(
            (acc, l) => acc.plus(l.taxAmount),
            new Prisma.Decimal(0),
          );

          // Check for first-cycle coupon redemption attached to subscription
          let discountAmount = new Prisma.Decimal(0.0);
          let appliedDiscountId: string | null = null;

          const couponMatch = subscription.notes?.match(/\[COUPON:([A-Za-z0-9_-]+)\]/);
          if (couponMatch && couponMatch[1]) {
            const couponCode = couponMatch[1];
            const discount = await tx.discount.findUnique({
              where: { code: couponCode },
            });
            if (discount && discount.isActive) {
              try {
                const redemption = await DiscountService.redeemDiscountAtomic(
                  tx,
                  discount.id,
                  subtotal,
                );
                discountAmount = redemption.discountAmount;
                appliedDiscountId = discount.id;
                // Mark coupon as redeemed in subscription notes so it only applies once
                const updatedNotes = subscription.notes
                  ? subscription.notes.replace(/\[COUPON:([A-Za-z0-9_-]+)\][^\n]*/, `[REDEEMED_COUPON:${couponCode}]`)
                  : null;
                await tx.subscription.update({
                  where: { id: subscription.id },
                  data: { notes: updatedNotes },
                });
              } catch (err: unknown) {
                logger.warn(`[BillingEngine] Could not redeem coupon ${couponCode}: ${(err as Error).message}`);
              }
            }
          }

          const baseTotal = subtotal.minus(discountAmount).plus(taxAmount);
          const totalAmount = roundMoney(baseTotal.lessThan(0) ? new Prisma.Decimal(0) : baseTotal);

          // Create Invoice
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              subscriptionId: subscription.id,
              customerId: subscription.customerId,
              status: InvoiceStatus.CONFIRMED,
              periodStartDate,
              periodEndDate,
              dueDate,
              subtotal,
              discountAmount,
              discountId: appliedDiscountId,
              taxAmount,
              totalAmount,
              paidAmount: new Prisma.Decimal(0.0),
              lines: {
                create: invoiceLines,
              },
            },
          });

          // Advance subscription next billing date
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { nextBillingDate: nextCycleBillingDate },
          });

          // Log successful BillingAttempt
          await tx.billingAttempt.create({
            data: {
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              status: BillingAttemptStatus.SUCCESS,
            },
          });

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            subscriptionNumber: subscription.subscriptionNumber,
            totalAmount: totalAmount.toFixed(2),
          };
        });

        if (generated) {
          result.successful += 1;
          result.invoices.push(generated);
        }
      } catch (err: unknown) {
        result.failed += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          `[BillingEngine] Failed billing subscription ${item.id}: ${errMsg}`,
        );
        result.errors.push({ subscriptionId: item.id, error: errMsg });

        // Log failed attempt outside transaction
        try {
          await prisma.billingAttempt.create({
            data: {
              subscriptionId: item.id,
              status: BillingAttemptStatus.FAILED,
              errorMessage: errMsg,
            },
          });
        } catch (logErr) {
          logger.error(`[BillingEngine] Failed logging billing attempt: ${logErr}`);
        }
      }
    }

    logger.info(
      `[BillingEngine] Cycle complete. Processed: ${result.processed}, Generated: ${result.successful}, Failed: ${result.failed}`,
    );

    return result;
  }
}
