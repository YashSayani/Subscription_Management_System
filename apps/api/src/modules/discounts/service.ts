import { prisma, Prisma } from '@brightloop/database';
import { DiscountType } from '@brightloop/shared';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { roundMoney, toDecimal, formatMoney } from '../../common/money.js';
import {
  CreateDiscountInput,
  UpdateDiscountInput,
  ValidateDiscountInput,
  ListDiscountsQuery,
} from './schema.js';

export class DiscountService {
  /**
   * Create a new discount code (Admin only).
   */
  static async createDiscount(input: CreateDiscountInput) {
    const existing = await prisma.discount.findUnique({
      where: { code: input.code },
    });
    if (existing) {
      throw new BadRequestError(`Discount code '${input.code}' already exists`);
    }

    const value = roundMoney(toDecimal(input.value));
    if (value.lessThanOrEqualTo(0)) {
      throw new BadRequestError('Discount value must be greater than zero');
    }

    if (input.type === DiscountType.PERCENTAGE && value.greaterThan(100)) {
      throw new BadRequestError('Percentage discount value cannot exceed 100%');
    }

    const validFrom = input.validFrom ? new Date(input.validFrom) : null;
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;

    if (validFrom && validUntil && validFrom > validUntil) {
      throw new BadRequestError('validFrom date cannot be after validUntil date');
    }

    const minPurchaseAmount = input.minPurchaseAmount !== undefined
      ? roundMoney(toDecimal(input.minPurchaseAmount))
      : null;

    const discount = await prisma.discount.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        type: input.type,
        value,
        minPurchaseAmount,
        minQuantity: input.minQuantity,
        validFrom,
        validUntil,
        usageLimit: input.usageLimit ?? null,
        isActive: input.isActive ?? true,
      },
    });

    return discount;
  }

  /**
   * Update an existing discount coupon.
   */
  static async updateDiscount(id: string, input: UpdateDiscountInput) {
    const discount = await prisma.discount.findUnique({
      where: { id },
    });
    if (!discount) {
      throw new NotFoundError(`Discount '${id}' not found`);
    }

    const data: Prisma.DiscountUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.usageLimit !== undefined) data.usageLimit = input.usageLimit;
    if (input.minQuantity !== undefined) data.minQuantity = input.minQuantity;

    if (input.value !== undefined) {
      const value = roundMoney(toDecimal(input.value));
      if (value.lessThanOrEqualTo(0)) {
        throw new BadRequestError('Discount value must be greater than zero');
      }
      if (discount.type === DiscountType.PERCENTAGE && value.greaterThan(100)) {
        throw new BadRequestError('Percentage discount value cannot exceed 100%');
      }
      data.value = value;
    }

    if (input.minPurchaseAmount !== undefined) {
      data.minPurchaseAmount = input.minPurchaseAmount !== null
        ? roundMoney(toDecimal(input.minPurchaseAmount))
        : null;
    }

    if (input.validFrom !== undefined) {
      data.validFrom = input.validFrom ? new Date(input.validFrom) : null;
    }

    if (input.validUntil !== undefined) {
      data.validUntil = input.validUntil ? new Date(input.validUntil) : null;
    }

    return prisma.discount.update({
      where: { id },
      data,
    });
  }

  /**
   * List discounts with filtering and pagination.
   */
  static async listDiscounts(query: ListDiscountsQuery) {
    const where: Prisma.DiscountWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, discounts] = await Promise.all([
      prisma.discount.count({ where }),
      prisma.discount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      discounts,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Get discount by ID.
   */
  static async getDiscountById(id: string) {
    const discount = await prisma.discount.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!discount) {
      throw new NotFoundError(`Discount '${id}' not found`);
    }

    return discount;
  }

  /**
   * Validate discount code against an order/quote subtotal.
   * Read-only preview (does not increment atomic counter).
   */
  static async validateDiscount(input: ValidateDiscountInput) {
    const discount = await prisma.discount.findUnique({
      where: { code: input.code },
    });

    if (!discount || !discount.isActive) {
      throw new BadRequestError(`Discount code '${input.code}' is invalid or inactive`);
    }

    const now = new Date();

    if (discount.validFrom && now < discount.validFrom) {
      throw new BadRequestError(`Discount code '${input.code}' is not yet active`);
    }

    if (discount.validUntil && now > discount.validUntil) {
      throw new BadRequestError(`Discount code '${input.code}' has expired`);
    }

    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
      throw new BadRequestError(`Discount code '${input.code}' has reached its maximum usage limit`);
    }

    const subtotal = roundMoney(toDecimal(input.subtotal));

    if (discount.minPurchaseAmount) {
      const minAmount = new Prisma.Decimal(discount.minPurchaseAmount);
      if (subtotal.lessThan(minAmount)) {
        throw new BadRequestError(
          `Minimum order subtotal of ₹${formatMoney(minAmount)} required to use code '${discount.code}'`,
        );
      }
    }

    // Calculate discount amount
    let discountAmount = new Prisma.Decimal(0);
    if (discount.type === DiscountType.PERCENTAGE) {
      discountAmount = roundMoney(
        subtotal.times(new Prisma.Decimal(discount.value)).dividedBy(100),
      );
    } else {
      // FIXED_AMOUNT cannot exceed order subtotal
      const fixedVal = new Prisma.Decimal(discount.value);
      discountAmount = roundMoney(
        subtotal.lessThan(fixedVal) ? subtotal : fixedVal,
      );
    }

    const newSubtotal = roundMoney(subtotal.minus(discountAmount));

    return {
      valid: true,
      discountId: discount.id,
      code: discount.code,
      name: discount.name,
      type: discount.type,
      value: discount.value.toString(),
      discountAmount: formatMoney(discountAmount),
      newSubtotal: formatMoney(newSubtotal),
    };
  }

  /**
   * Atomic Discount Redemption with Race Condition Protection.
   * Executes atomic conditional UPDATE ... WHERE used_count < usage_limit RETURNING *.
   * Neutralizes concurrent double-redemption attacks.
   */
  static async redeemDiscountAtomic(
    tx: Prisma.TransactionClient,
    discountId: string,
    subtotal: Prisma.Decimal,
  ) {
    // Atomic conditional SQL update
    const updated = await tx.$queryRaw<Array<{
      id: string;
      code: string;
      name: string;
      type: DiscountType;
      value: Prisma.Decimal;
      min_purchase_amount: Prisma.Decimal | null;
      used_count: number;
      usage_limit: number | null;
    }>>`
      UPDATE discounts
      SET used_count = used_count + 1,
          updated_at = NOW()
      WHERE id = ${discountId}
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (usage_limit IS NULL OR used_count < usage_limit)
      RETURNING id, code, name, type, value, min_purchase_amount, used_count, usage_limit
    `;

    if (!updated || updated.length === 0) {
      throw new BadRequestError(
        'Discount coupon has reached its maximum redemption limit, has expired, or is inactive',
      );
    }

    const discount = updated[0];

    // Validate minPurchaseAmount if set
    if (discount.min_purchase_amount) {
      const minAmount = new Prisma.Decimal(discount.min_purchase_amount);
      if (subtotal.lessThan(minAmount)) {
        throw new BadRequestError(
          `Minimum order subtotal of ₹${formatMoney(minAmount)} required to use code '${discount.code}'`,
        );
      }
    }

    // Compute actual discount deduction
    let discountAmount = new Prisma.Decimal(0);
    if (discount.type === DiscountType.PERCENTAGE) {
      discountAmount = roundMoney(
        subtotal.times(new Prisma.Decimal(discount.value)).dividedBy(100),
      );
    } else {
      const fixedVal = new Prisma.Decimal(discount.value);
      discountAmount = roundMoney(
        subtotal.lessThan(fixedVal) ? subtotal : fixedVal,
      );
    }

    return {
      discountId: discount.id,
      code: discount.code,
      discountAmount,
      newUsedCount: discount.used_count,
    };
  }
}
