import { prisma, Prisma } from '@brightloop/database';
import { UserRole, InvoiceStatus, PaymentMethod } from '@brightloop/shared';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { roundMoney, toDecimal, formatMoney } from '../../common/money.js';
import { RecordPaymentInput, ApplyCreditInput, ListPaymentsQuery } from './schema.js';

export class PaymentService {
  /**
   * Record a manual payment, optionally allocate across one or more invoices,
   * and credit any surplus to the customer's credit balance.
   */
  static async recordPayment(
    recordedById: string,
    actorRole: string,
    input: RecordPaymentInput,
  ) {
    // 1. Verify customer
    const customer = await prisma.user.findUnique({
      where: { id: input.customerId },
    });
    if (!customer || !customer.isActive || customer.deletedAt !== null) {
      throw new NotFoundError(`Active customer '${input.customerId}' not found`);
    }

    const paymentAmount = roundMoney(toDecimal(input.amount));
    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    // 2. Validate allocations if provided
    let totalAllocated = new Prisma.Decimal(0);
    const validatedAllocations: Array<{
      invoiceId: string;
      amount: Prisma.Decimal;
      invoice: {
        id: string;
        invoiceNumber: string;
        totalAmount: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        status: string;
      };
    }> = [];

    if (input.allocations && input.allocations.length > 0) {
      const seenInvoices = new Set<string>();

      for (const alloc of input.allocations) {
        if (seenInvoices.has(alloc.invoiceId)) {
          throw new BadRequestError(`Duplicate allocation for invoice '${alloc.invoiceId}'`);
        }
        seenInvoices.add(alloc.invoiceId);

        const allocAmount = roundMoney(toDecimal(alloc.amount));
        if (allocAmount.lessThanOrEqualTo(0)) {
          throw new BadRequestError('Allocation amount must be greater than zero');
        }

        const invoice = await prisma.invoice.findUnique({
          where: { id: alloc.invoiceId },
        });

        if (!invoice) {
          throw new NotFoundError(`Invoice '${alloc.invoiceId}' not found`);
        }

        if (invoice.customerId !== input.customerId) {
          throw new BadRequestError(
            `Invoice '${invoice.invoiceNumber}' does not belong to customer '${customer.fullName}'`,
          );
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
          throw new BadRequestError(`Cannot allocate payment to cancelled invoice '${invoice.invoiceNumber}'`);
        }

        if (invoice.status === InvoiceStatus.PAID) {
          throw new BadRequestError(`Invoice '${invoice.invoiceNumber}' is already fully paid`);
        }

        const balanceDue = roundMoney(
          new Prisma.Decimal(invoice.totalAmount).minus(new Prisma.Decimal(invoice.paidAmount)),
        );

        if (allocAmount.greaterThan(balanceDue)) {
          throw new BadRequestError(
            `Allocation amount (₹${allocAmount.toFixed(2)}) exceeds balance due (₹${balanceDue.toFixed(2)}) on invoice '${invoice.invoiceNumber}'`,
          );
        }

        totalAllocated = roundMoney(totalAllocated.plus(allocAmount));
        validatedAllocations.push({
          invoiceId: alloc.invoiceId,
          amount: allocAmount,
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: new Prisma.Decimal(invoice.totalAmount),
            paidAmount: new Prisma.Decimal(invoice.paidAmount),
            status: invoice.status,
          },
        });
      }

      if (totalAllocated.greaterThan(paymentAmount)) {
        throw new BadRequestError(
          `Total allocated amount (₹${totalAllocated.toFixed(2)}) exceeds total payment amount (₹${paymentAmount.toFixed(2)})`,
        );
      }
    }

    const surplusAmount = roundMoney(paymentAmount.minus(totalAllocated));

    // 3. Execute atomic transaction
    return prisma.$transaction(async (tx) => {
      // Generate sequence number: PAY-YYYY-XXXXX
      const [seqRes] = await tx.$queryRaw<[{ num: string }]>`SELECT generate_payment_number() as num`;
      const paymentNumber = seqRes.num;

      const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: input.customerId,
          paymentDate,
          amount: paymentAmount,
          method: input.method as PaymentMethod,
          notes: input.notes,
          recordedById,
        },
      });

      // Create allocations and update invoice balances
      for (const alloc of validatedAllocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            amount: alloc.amount,
          },
        });

        // Re-read invoice with row lock
        const currentInvoice = await tx.invoice.findUniqueOrThrow({
          where: { id: alloc.invoiceId },
        });

        const newPaidAmount = roundMoney(
          new Prisma.Decimal(currentInvoice.paidAmount).plus(alloc.amount),
        );
        const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(currentInvoice.totalAmount);

        await tx.invoice.update({
          where: { id: alloc.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          },
        });
      }

      // If surplus exists, credit customer credit balance (Decision D-07)
      if (surplusAmount.greaterThan(0)) {
        await tx.user.update({
          where: { id: input.customerId },
          data: {
            creditBalance: {
              increment: surplusAmount,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: recordedById,
            actorRole,
            action: 'PAYMENT_SURPLUS_CREDITED',
            entityType: 'User',
            entityId: input.customerId,
            newValues: {
              paymentNumber,
              surplusAmount: surplusAmount.toString(),
            },
          },
        });
      }

      // Fetch created payment with relations
      const result = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              companyName: true,
              creditBalance: true,
            },
          },
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  paidAmount: true,
                  status: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      });

      return {
        ...result,
        totalAllocated: formatMoney(totalAllocated),
        surplusAmount: formatMoney(surplusAmount),
      };
    });
  }

  /**
   * Apply customer's credit balance to pay down an open invoice.
   */
  static async applyCredit(
    recordedById: string,
    actorRole: string,
    userRole: UserRole,
    input: ApplyCreditInput,
  ) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice '${input.invoiceId}' not found`);
    }

    // Ownership check for customers
    if (userRole === UserRole.CUSTOMER && invoice.customerId !== recordedById) {
      throw new NotFoundError(`Invoice '${input.invoiceId}' not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestError('Cannot apply credit to a cancelled invoice');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Invoice is already fully paid');
    }

    const creditAmount = roundMoney(toDecimal(input.amount));
    if (creditAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestError('Credit amount must be greater than zero');
    }

    const balanceDue = roundMoney(
      new Prisma.Decimal(invoice.totalAmount).minus(new Prisma.Decimal(invoice.paidAmount)),
    );

    if (creditAmount.greaterThan(balanceDue)) {
      throw new BadRequestError(
        `Credit amount (₹${creditAmount.toFixed(2)}) exceeds invoice balance due (₹${balanceDue.toFixed(2)})`,
      );
    }

    const customerCredit = new Prisma.Decimal(invoice.customer.creditBalance);
    if (creditAmount.greaterThan(customerCredit)) {
      throw new BadRequestError(
        `Insufficient customer credit balance (Available: ₹${customerCredit.toFixed(2)}, Requested: ₹${creditAmount.toFixed(2)})`,
      );
    }

    return prisma.$transaction(async (tx) => {
      // Generate sequence number: PAY-YYYY-XXXXX
      const [seqRes] = await tx.$queryRaw<[{ num: string }]>`SELECT generate_payment_number() as num`;
      const paymentNumber = seqRes.num;

      // 1. Deduct customer credit balance
      await tx.user.update({
        where: { id: invoice.customerId },
        data: {
          creditBalance: {
            decrement: creditAmount,
          },
        },
      });

      // 2. Create payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: invoice.customerId,
          paymentDate: new Date(),
          amount: creditAmount,
          method: PaymentMethod.OTHER,
          notes: 'Settlement via customer credit balance',
          recordedById,
        },
      });

      // 3. Create allocation
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: creditAmount,
        },
      });

      // 4. Update invoice paid amount and status
      const newPaidAmount = roundMoney(
        new Prisma.Decimal(invoice.paidAmount).plus(creditAmount),
      );
      const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(invoice.totalAmount);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        },
      });

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          actorId: recordedById,
          actorRole,
          action: 'CREDIT_APPLIED_TO_INVOICE',
          entityType: 'Invoice',
          entityId: invoice.id,
          newValues: {
            paymentNumber,
            amount: creditAmount.toString(),
            newPaidAmount: newPaidAmount.toString(),
            isFullyPaid,
          },
        },
      });

      const result = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              creditBalance: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  paidAmount: true,
                  status: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      });

      return {
        ...result,
        totalAllocated: formatMoney(creditAmount),
        surplusAmount: '0.00',
      };
    });
  }

  /**
   * List payments with filtering and scoping.
   */
  static async listPayments(
    user: { id: string; role: UserRole },
    query: ListPaymentsQuery,
  ) {
    const where: Prisma.PaymentWhereInput = {};

    // Customer scoping
    if (user.role === UserRole.CUSTOMER) {
      where.customerId = user.id;
    } else if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.method) {
      where.method = query.method;
    }

    if (query.startDate || query.endDate) {
      where.paymentDate = {};
      if (query.startDate) where.paymentDate.gte = new Date(query.startDate);
      if (query.endDate) where.paymentDate.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { paymentNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
        { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { customer: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              companyName: true,
              creditBalance: true,
            },
          },
          recordedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  paidAmount: true,
                  status: true,
                  dueDate: true,
                },
              },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const formattedPayments = payments.map((p) => {
      const totalAllocated = p.allocations.reduce(
        (sum, a) => sum.plus(new Prisma.Decimal(a.amount)),
        new Prisma.Decimal(0),
      );
      const surplus = roundMoney(new Prisma.Decimal(p.amount).minus(totalAllocated));

      return {
        ...p,
        totalAllocated: formatMoney(totalAllocated),
        surplusAmount: formatMoney(surplus.greaterThan(0) ? surplus : 0),
      };
    });

    return {
      payments: formattedPayments,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get payment by ID with customer ownership check.
   */
  static async getPaymentById(user: { id: string; role: UserRole }, id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            fullName: true,
            companyName: true,
            creditBalance: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError(`Payment '${id}' not found`);
    }

    if (user.role === UserRole.CUSTOMER && payment.customerId !== user.id) {
      throw new NotFoundError(`Payment '${id}' not found`);
    }

    const totalAllocated = payment.allocations.reduce(
      (sum, a) => sum.plus(new Prisma.Decimal(a.amount)),
      new Prisma.Decimal(0),
    );
    const surplus = roundMoney(new Prisma.Decimal(payment.amount).minus(totalAllocated));

    return {
      ...payment,
      totalAllocated: formatMoney(totalAllocated),
      surplusAmount: formatMoney(surplus.greaterThan(0) ? surplus : 0),
    };
  }
}
