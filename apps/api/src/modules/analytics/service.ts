import { prisma, Prisma } from '@brightloop/database';
import {
  BillingFrequency,
  SubscriptionStatus,
  InvoiceStatus,
  AnalyticsOverviewDto,
  AgingReportDto,
  AgingReportBracketDto,
  OverdueInvoiceSummaryDto,
  RevenueTrendItemDto,
  RevenueTrendsDto,
} from '@brightloop/shared';
import { roundMoney, formatMoney } from '../../common/money.js';

export class AnalyticsService {
  /**
   * Calculate high-level financial overview and subscription KPI metrics.
   */
  static async getOverview(): Promise<AnalyticsOverviewDto> {
    const now = new Date();

    // 1. Fetch active subscriptions for MRR calculation
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CONFIRMED],
        },
      },
      include: {
        plan: true,
        lines: true,
      },
    });

    let totalMrr = new Prisma.Decimal(0);

    for (const sub of activeSubscriptions) {
      // Sum line totals for this subscription
      const subTotal = sub.lines.reduce(
        (sum, line) => sum.plus(new Prisma.Decimal(line.totalAmount)),
        new Prisma.Decimal(0),
      );

      // Normalize by billing frequency
      let monthlyAmount = new Prisma.Decimal(0);
      switch (sub.plan.billingFrequency) {
        case BillingFrequency.DAILY:
          monthlyAmount = roundMoney(subTotal.times(30));
          break;
        case BillingFrequency.WEEKLY:
          monthlyAmount = roundMoney(subTotal.times(52).dividedBy(12));
          break;
        case BillingFrequency.YEARLY:
          monthlyAmount = roundMoney(subTotal.dividedBy(12));
          break;
        case BillingFrequency.MONTHLY:
        default:
          monthlyAmount = roundMoney(subTotal);
          break;
      }

      totalMrr = roundMoney(totalMrr.plus(monthlyAmount));
    }

    const totalArr = roundMoney(totalMrr.times(12));

    // 2. Fetch total revenue collected from payment allocations
    const allocationAggregate = await prisma.paymentAllocation.aggregate({
      _sum: {
        amount: true,
      },
    });
    const totalRevenueCollected = allocationAggregate._sum.amount
      ? roundMoney(new Prisma.Decimal(allocationAggregate._sum.amount))
      : new Prisma.Decimal(0);

    // 3. Fetch open invoices for AR and Overdue balance
    const openInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    let outstandingArBalance = new Prisma.Decimal(0);
    let overdueBalance = new Prisma.Decimal(0);
    let overdueInvoicesCount = 0;

    for (const inv of openInvoices) {
      const balanceDue = roundMoney(
        new Prisma.Decimal(inv.totalAmount).minus(new Prisma.Decimal(inv.paidAmount)),
      );
      outstandingArBalance = roundMoney(outstandingArBalance.plus(balanceDue));

      if (new Date(inv.dueDate) < now) {
        overdueBalance = roundMoney(overdueBalance.plus(balanceDue));
        overdueInvoicesCount += 1;
      }
    }

    // 4. Subscription counts and churn rate
    const [activeCount, pausedCount, closedCount, totalSubsCount] = await Promise.all([
      prisma.subscription.count({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CONFIRMED] } },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.PAUSED },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.CLOSED },
      }),
      prisma.subscription.count(),
    ]);

    const churnRate =
      totalSubsCount > 0
        ? ((closedCount / totalSubsCount) * 100).toFixed(1)
        : '0.0';

    return {
      mrr: formatMoney(totalMrr),
      arr: formatMoney(totalArr),
      totalRevenueCollected: formatMoney(totalRevenueCollected),
      outstandingArBalance: formatMoney(outstandingArBalance),
      overdueBalance: formatMoney(overdueBalance),
      overdueInvoicesCount,
      activeSubscriptionsCount: activeCount,
      pausedSubscriptionsCount: pausedCount,
      closedSubscriptionsCount: closedCount,
      totalSubscriptionsCount: totalSubsCount,
      churnRate,
    };
  }

  /**
   * Generate Accounts Receivable Aging Report with standard accounting brackets.
   */
  static async getAgingReport(): Promise<AgingReportDto> {
    const now = new Date();

    const openInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const brackets: Record<
      'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS',
      { label: string; count: number; totalAmount: Prisma.Decimal }
    > = {
      CURRENT: { label: 'Current / Not Due', count: 0, totalAmount: new Prisma.Decimal(0) },
      DAYS_1_30: { label: '1 - 30 Days Overdue', count: 0, totalAmount: new Prisma.Decimal(0) },
      DAYS_31_60: { label: '31 - 60 Days Overdue', count: 0, totalAmount: new Prisma.Decimal(0) },
      DAYS_61_90: { label: '61 - 90 Days Overdue', count: 0, totalAmount: new Prisma.Decimal(0) },
      DAYS_90_PLUS: { label: '90+ Days Overdue', count: 0, totalAmount: new Prisma.Decimal(0) },
    };

    let totalOutstanding = new Prisma.Decimal(0);
    let totalOverdue = new Prisma.Decimal(0);
    const overdueInvoicesList: OverdueInvoiceSummaryDto[] = [];

    for (const inv of openInvoices) {
      const balanceDue = roundMoney(
        new Prisma.Decimal(inv.totalAmount).minus(new Prisma.Decimal(inv.paidAmount)),
      );
      totalOutstanding = roundMoney(totalOutstanding.plus(balanceDue));

      const dueDate = new Date(inv.dueDate);
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        brackets.CURRENT.count += 1;
        brackets.CURRENT.totalAmount = roundMoney(brackets.CURRENT.totalAmount.plus(balanceDue));
      } else {
        totalOverdue = roundMoney(totalOverdue.plus(balanceDue));

        if (diffDays <= 30) {
          brackets.DAYS_1_30.count += 1;
          brackets.DAYS_1_30.totalAmount = roundMoney(brackets.DAYS_1_30.totalAmount.plus(balanceDue));
        } else if (diffDays <= 60) {
          brackets.DAYS_31_60.count += 1;
          brackets.DAYS_31_60.totalAmount = roundMoney(brackets.DAYS_31_60.totalAmount.plus(balanceDue));
        } else if (diffDays <= 90) {
          brackets.DAYS_61_90.count += 1;
          brackets.DAYS_61_90.totalAmount = roundMoney(brackets.DAYS_61_90.totalAmount.plus(balanceDue));
        } else {
          brackets.DAYS_90_PLUS.count += 1;
          brackets.DAYS_90_PLUS.totalAmount = roundMoney(brackets.DAYS_90_PLUS.totalAmount.plus(balanceDue));
        }

        overdueInvoicesList.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId,
          customerName: inv.customer?.fullName || 'Unknown',
          dueDate: inv.dueDate.toISOString(),
          daysOverdue: diffDays,
          totalAmount: formatMoney(inv.totalAmount),
          paidAmount: formatMoney(inv.paidAmount),
          balanceDue: formatMoney(balanceDue),
          status: inv.status as InvoiceStatus,
        });
      }
    }

    const formattedBrackets: AgingReportBracketDto[] = [
      {
        bracket: 'CURRENT',
        label: brackets.CURRENT.label,
        count: brackets.CURRENT.count,
        totalAmount: formatMoney(brackets.CURRENT.totalAmount),
      },
      {
        bracket: 'DAYS_1_30',
        label: brackets.DAYS_1_30.label,
        count: brackets.DAYS_1_30.count,
        totalAmount: formatMoney(brackets.DAYS_1_30.totalAmount),
      },
      {
        bracket: 'DAYS_31_60',
        label: brackets.DAYS_31_60.label,
        count: brackets.DAYS_31_60.count,
        totalAmount: formatMoney(brackets.DAYS_31_60.totalAmount),
      },
      {
        bracket: 'DAYS_61_90',
        label: brackets.DAYS_61_90.label,
        count: brackets.DAYS_61_90.count,
        totalAmount: formatMoney(brackets.DAYS_61_90.totalAmount),
      },
      {
        bracket: 'DAYS_90_PLUS',
        label: brackets.DAYS_90_PLUS.label,
        count: brackets.DAYS_90_PLUS.count,
        totalAmount: formatMoney(brackets.DAYS_90_PLUS.totalAmount),
      },
    ];

    return {
      totalOutstanding: formatMoney(totalOutstanding),
      totalOverdue: formatMoney(totalOverdue),
      brackets: formattedBrackets,
      overdueInvoices: overdueInvoicesList,
    };
  }

  /**
   * Historical 6-month revenue collection and billing trends.
   */
  static async getRevenueTrends(): Promise<RevenueTrendsDto> {
    const trends: RevenueTrendItemDto[] = [];
    const now = new Date();

    // Iterate backwards 6 months
    for (let i = 5; i >= 0; i--) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const monthLabel = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`;

      // Sum billed in this month
      const invoiceAgg = await prisma.invoice.aggregate({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: {
            not: InvoiceStatus.CANCELLED,
          },
        },
        _sum: {
          totalAmount: true,
        },
      });

      // Sum collected in this month
      const allocationAgg = await prisma.paymentAllocation.aggregate({
        where: {
          allocatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });

      // Count new subscriptions created in this month
      const subsCount = await prisma.subscription.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      trends.push({
        month: monthLabel,
        billedAmount: formatMoney(invoiceAgg._sum.totalAmount || 0),
        collectedAmount: formatMoney(allocationAgg._sum.amount || 0),
        newSubscriptionsCount: subsCount,
      });
    }

    return { trends };
  }
}
