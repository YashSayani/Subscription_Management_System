import {
  prisma,
  Prisma,
  SubscriptionStatus,
} from '@brightloop/database';
import { UserRole } from '@brightloop/shared';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../common/errors.js';
import { roundMoney, multiplyMoney } from '../../common/money.js';
import { AuthUser } from '../../common/types.js';
import {
  CreateSubscriptionInput,
  TransitionSubscriptionInput,
  CreateQuotationTemplateInput,
} from './schema.js';

export class SubscriptionService {
  // ===================== CREATE SUBSCRIPTION / QUOTATION =====================

  static async createSubscription(
    input: CreateSubscriptionInput,
    requestingUser: AuthUser,
  ) {
    // 1. Determine customer ID
    let customerId = requestingUser.userId;
    if (requestingUser.role === UserRole.ADMIN || requestingUser.role === UserRole.STAFF) {
      customerId = input.customerId || requestingUser.userId;
    }

    // 2. Validate customer existence
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
    });
    if (!customer || !customer.isActive || customer.deletedAt !== null) {
      throw new NotFoundError(`Active customer '${customerId}' not found`);
    }

    // 3. Validate plan existence & constraints
    const plan = await prisma.plan.findUnique({
      where: { id: input.planId },
    });
    if (!plan || !plan.isActive || plan.deletedAt !== null) {
      throw new NotFoundError(`Active subscription plan '${input.planId}' not found`);
    }

    const totalQuantity = input.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (totalQuantity < plan.minQuantity) {
      throw new BadRequestError(
        `Total line quantity (${totalQuantity}) does not satisfy plan minimum quantity (${plan.minQuantity})`,
      );
    }

    // 4. Calculate and snapshot each line item
    const snapshotLines: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      variantAdjustment: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
    }> = [];
    for (const line of input.lines) {
      const product = await prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product || !product.isAvailable || product.deletedAt !== null) {
        throw new NotFoundError(`Available product '${line.productId}' not found`);
      }

      let variantAdjustment = new Prisma.Decimal(0);
      if (line.variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: line.variantId },
        });
        if (
          !variant ||
          variant.productId !== line.productId ||
          !variant.isAvailable ||
          variant.deletedAt !== null
        ) {
          throw new NotFoundError(`Valid variant '${line.variantId}' not found on product`);
        }
        variantAdjustment = new Prisma.Decimal(variant.priceAdjustment);
      }

      const unitPrice = roundMoney(new Prisma.Decimal(product.salesPrice).plus(variantAdjustment));
      if (unitPrice.lessThan(0)) {
        throw new BadRequestError(`Unit price for product '${product.name}' cannot be negative`);
      }

      const subtotal = multiplyMoney(unitPrice, line.quantity);
      const taxRate = new Prisma.Decimal(line.taxRate ?? 18.0);
      const taxAmount = roundMoney(subtotal.times(taxRate).dividedBy(100));
      const totalAmount = roundMoney(subtotal.plus(taxAmount));

      snapshotLines.push({
        productId: line.productId,
        variantId: line.variantId || null,
        quantity: line.quantity,
        unitPrice,
        variantAdjustment,
        taxRate,
        subtotal,
        taxAmount,
        totalAmount,
      });
    }

    // 5. Transaction: generate sequence number and persist subscription
    return prisma.$transaction(async (tx) => {
      const [seqRes] = await tx.$queryRaw<[{ num: string }]>`SELECT generate_subscription_number() as num`;
      const subscriptionNumber = seqRes.num;

      const defaultQuoteExpiry = new Date();
      defaultQuoteExpiry.setDate(defaultQuoteExpiry.getDate() + 30);

      const quoteValidUntil = input.quoteValidUntil
        ? new Date(input.quoteValidUntil)
        : input.status === SubscriptionStatus.QUOTATION
          ? defaultQuoteExpiry
          : null;

      const subscription = await tx.subscription.create({
        data: {
          subscriptionNumber,
          customerId,
          planId: input.planId,
          status: input.status,
          quoteValidUntil,
          paymentTermsDays: input.paymentTermsDays,
          notes: input.notes,
          lines: {
            create: snapshotLines,
          },
        },
        include: {
          customer: {
            select: { id: true, email: true, fullName: true, companyName: true },
          },
          plan: true,
          lines: {
            include: {
              product: { select: { id: true, name: true, salesPrice: true } },
              variant: { select: { id: true, attributeName: true, attributeValue: true, priceAdjustment: true } },
            },
          },
        },
      });

      return subscription;
    });
  }

  // ===================== LIST SUBSCRIPTIONS =====================

  static async listSubscriptions(
    options: {
      customerId?: string;
      status?: SubscriptionStatus;
      planId?: string;
      search?: string;
    },
    requestingUser: AuthUser,
  ) {
    const where: Prisma.SubscriptionWhereInput = {};

    // Customer IDOR mitigation: strictly scope to authenticated customer
    if (requestingUser.role === UserRole.CUSTOMER) {
      where.customerId = requestingUser.userId;
    } else if (options.customerId) {
      where.customerId = options.customerId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.planId) {
      where.planId = options.planId;
    }

    if (options.search) {
      where.OR = [
        { subscriptionNumber: { contains: options.search, mode: 'insensitive' } },
        { customer: { fullName: { contains: options.search, mode: 'insensitive' } } },
        { customer: { email: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    return prisma.subscription.findMany({
      where,
      include: {
        customer: {
          select: { id: true, email: true, fullName: true, companyName: true },
        },
        plan: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, salesPrice: true } },
            variant: { select: { id: true, attributeName: true, attributeValue: true, priceAdjustment: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===================== GET SUBSCRIPTION BY ID =====================

  static async getSubscriptionById(id: string, requestingUser: AuthUser) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, email: true, fullName: true, companyName: true },
        },
        plan: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, salesPrice: true } },
            variant: { select: { id: true, attributeName: true, attributeValue: true, priceAdjustment: true } },
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundError(`Subscription with ID '${id}' not found`);
    }

    // IDOR protection: return 404 if customer tries to inspect another's record
    if (
      requestingUser.role === UserRole.CUSTOMER &&
      subscription.customerId !== requestingUser.userId
    ) {
      throw new NotFoundError(`Subscription with ID '${id}' not found`);
    }

    return subscription;
  }

  // ===================== STATE MACHINE TRANSITIONS =====================

  static async transitionSubscription(
    id: string,
    input: TransitionSubscriptionInput,
    requestingUser: AuthUser,
  ) {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundError(`Subscription with ID '${id}' not found`);
    }

    // RBAC and ownership authorization check
    if (requestingUser.role === UserRole.CUSTOMER) {
      if (subscription.customerId !== requestingUser.userId) {
        throw new NotFoundError(`Subscription with ID '${id}' not found`);
      }
      // Customer is only permitted to CONFIRM their quote or CLOSE their agreement
      if (input.action !== 'CONFIRM' && input.action !== 'CLOSE') {
        throw new ForbiddenError(
          `Customers are only authorized to confirm quotations or close agreements.`,
        );
      }
    }

    const currentStatus = subscription.status;
    const now = new Date();
    const updateData: Prisma.SubscriptionUpdateInput = {};

    switch (input.action) {
      case 'CONFIRM':
        if (
          currentStatus !== SubscriptionStatus.DRAFT &&
          currentStatus !== SubscriptionStatus.QUOTATION
        ) {
          throw new BadRequestError(
            `Cannot confirm subscription in '${currentStatus}' status. Must be DRAFT or QUOTATION.`,
          );
        }
        updateData.status = SubscriptionStatus.CONFIRMED;
        break;

      case 'ACTIVATE':
        if (currentStatus !== SubscriptionStatus.CONFIRMED) {
          throw new BadRequestError(
            `Cannot activate subscription in '${currentStatus}' status. Must be CONFIRMED.`,
          );
        }
        updateData.status = SubscriptionStatus.ACTIVE;
        updateData.startDate = now;
        updateData.nextBillingDate = now; // In-advance billing starts immediately
        break;

      case 'PAUSE':
        if (currentStatus !== SubscriptionStatus.ACTIVE) {
          throw new BadRequestError(
            `Cannot pause subscription in '${currentStatus}' status. Must be ACTIVE.`,
          );
        }
        if (!subscription.plan.pauseAllowed) {
          throw new BadRequestError('Subscription plan terms do not permit pausing.');
        }
        updateData.status = SubscriptionStatus.PAUSED;
        updateData.pausedAt = now;
        break;

      case 'RESUME':
        if (currentStatus !== SubscriptionStatus.PAUSED) {
          throw new BadRequestError(
            `Cannot resume subscription in '${currentStatus}' status. Must be PAUSED.`,
          );
        }
        updateData.status = SubscriptionStatus.ACTIVE;
        updateData.pausedAt = null;
        // As per Decision D-05: Resume sets next_billing_date = resume_date with zero retroactive backfill
        updateData.nextBillingDate = now;
        break;

      case 'CLOSE':
        if (currentStatus === SubscriptionStatus.CLOSED) {
          throw new BadRequestError('Subscription is already CLOSED.');
        }
        // As per Decision D-06: Early termination provides no refunds; invoices stand
        updateData.status = SubscriptionStatus.CLOSED;
        updateData.closedAt = now;
        break;

      default:
        throw new BadRequestError(`Unknown transition action '${input.action}'`);
    }

    if (input.notes) {
      updateData.notes = subscription.notes
        ? `${subscription.notes}\n[${now.toISOString()}] ${input.notes}`
        : `[${now.toISOString()}] ${input.notes}`;
    }

    return prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, email: true, fullName: true, companyName: true },
        },
        plan: true,
        lines: {
          include: {
            product: { select: { id: true, name: true, salesPrice: true } },
            variant: { select: { id: true, attributeName: true, attributeValue: true, priceAdjustment: true } },
          },
        },
      },
    });
  }

  // ===================== QUOTATION TEMPLATES =====================

  static async listTemplates() {
    return prisma.quotationTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createTemplate(input: CreateQuotationTemplateInput) {
    return prisma.quotationTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        templateLines: input.templateLines as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
