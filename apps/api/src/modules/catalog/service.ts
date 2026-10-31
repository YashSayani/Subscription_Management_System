import { prisma, Prisma, BillingFrequency } from '@brightloop/database';
import { NotFoundError, ConflictError, BadRequestError } from '../../common/errors.js';
import { roundMoney, multiplyMoney } from '../../common/money.js';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  CreatePlanInput,
  UpdatePlanInput,
  CalculatePriceInput,
} from './schema.js';

export class CatalogService {
  // ===================== PRODUCTS =====================

  static async listProducts(options?: {
    includeArchived?: boolean;
    type?: string;
    search?: string;
  }) {
    const where: Prisma.ProductWhereInput = {};

    if (!options?.includeArchived) {
      where.deletedAt = null;
      where.isAvailable = true;
    }

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }

    return prisma.product.findMany({
      where,
      include: {
        variants: {
          where: options?.includeArchived ? undefined : { deletedAt: null, isAvailable: true },
          orderBy: [{ attributeName: 'asc' }, { attributeValue: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async getProductById(id: string, includeArchived = false) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          where: includeArchived ? undefined : { deletedAt: null, isAvailable: true },
          orderBy: [{ attributeName: 'asc' }, { attributeValue: 'asc' }],
        },
      },
    });

    if (!product || (!includeArchived && product.deletedAt !== null)) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    return product;
  }

  static async createProduct(input: CreateProductInput) {
    const { variants, salesPrice, costPrice, ...productData } = input;

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          salesPrice: new Prisma.Decimal(salesPrice),
          costPrice: new Prisma.Decimal(costPrice),
          variants: variants && variants.length > 0
            ? {
                create: variants.map((v) => ({
                  attributeName: v.attributeName,
                  attributeValue: v.attributeValue,
                  priceAdjustment: new Prisma.Decimal(v.priceAdjustment),
                  isAvailable: v.isAvailable,
                })),
              }
            : undefined,
        },
        include: {
          variants: true,
        },
      });

      return product;
    });
  }

  static async updateProduct(id: string, input: UpdateProductInput) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isAvailable !== undefined) updateData.isAvailable = input.isAvailable;
    if (input.salesPrice !== undefined) updateData.salesPrice = new Prisma.Decimal(input.salesPrice);
    if (input.costPrice !== undefined) updateData.costPrice = new Prisma.Decimal(input.costPrice);

    return prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        variants: {
          where: { deletedAt: null },
        },
      },
    });
  }

  static async deleteProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    return prisma.$transaction(async (tx) => {
      // Soft-delete variants as well
      await tx.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: new Date(), isAvailable: false },
      });

      return tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isAvailable: false },
      });
    });
  }

  // ===================== VARIANTS =====================

  static async addVariant(productId: string, input: CreateVariantInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt !== null) {
      throw new NotFoundError(`Product with ID '${productId}' not found`);
    }

    // Check unique (productId, attributeName, attributeValue)
    const existing = await prisma.productVariant.findFirst({
      where: {
        productId,
        attributeName: input.attributeName,
        attributeValue: input.attributeValue,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictError(
        `Variant '${input.attributeName}: ${input.attributeValue}' already exists for this product`,
      );
    }

    return prisma.productVariant.create({
      data: {
        productId,
        attributeName: input.attributeName,
        attributeValue: input.attributeValue,
        priceAdjustment: new Prisma.Decimal(input.priceAdjustment),
        isAvailable: input.isAvailable,
      },
    });
  }

  static async updateVariant(id: string, input: UpdateVariantInput) {
    const variant = await prisma.productVariant.findUnique({ where: { id } });
    if (!variant || variant.deletedAt !== null) {
      throw new NotFoundError(`Variant with ID '${id}' not found`);
    }

    const updateData: Prisma.ProductVariantUpdateInput = {};
    if (input.attributeName !== undefined) updateData.attributeName = input.attributeName;
    if (input.attributeValue !== undefined) updateData.attributeValue = input.attributeValue;
    if (input.isAvailable !== undefined) updateData.isAvailable = input.isAvailable;
    if (input.priceAdjustment !== undefined) {
      updateData.priceAdjustment = new Prisma.Decimal(input.priceAdjustment);
    }

    return prisma.productVariant.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteVariant(id: string) {
    const variant = await prisma.productVariant.findUnique({ where: { id } });
    if (!variant || variant.deletedAt !== null) {
      throw new NotFoundError(`Variant with ID '${id}' not found`);
    }

    return prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date(), isAvailable: false },
    });
  }

  // ===================== PLANS =====================

  static async listPlans(options?: {
    includeArchived?: boolean;
    frequency?: BillingFrequency;
  }) {
    const where: Prisma.PlanWhereInput = {};

    if (!options?.includeArchived) {
      where.deletedAt = null;
      where.isActive = true;
    }

    if (options?.frequency) {
      where.billingFrequency = options.frequency;
    }

    return prisma.plan.findMany({
      where,
      orderBy: [{ billingFrequency: 'asc' }, { name: 'asc' }],
    });
  }

  static async getPlanById(id: string, includeArchived = false) {
    const plan = await prisma.plan.findUnique({ where: { id } });

    if (!plan || (!includeArchived && plan.deletedAt !== null)) {
      throw new NotFoundError(`Plan with ID '${id}' not found`);
    }

    return plan;
  }

  static async createPlan(input: CreatePlanInput) {
    return prisma.plan.create({
      data: {
        name: input.name,
        description: input.description,
        billingFrequency: input.billingFrequency,
        minQuantity: input.minQuantity,
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
        availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
        autoClose: input.autoClose,
        pauseAllowed: input.pauseAllowed,
        isActive: input.isActive,
      },
    });
  }

  static async updatePlan(id: string, input: UpdatePlanInput) {
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan || plan.deletedAt !== null) {
      throw new NotFoundError(`Plan with ID '${id}' not found`);
    }

    const updateData: Prisma.PlanUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.billingFrequency !== undefined) updateData.billingFrequency = input.billingFrequency;
    if (input.minQuantity !== undefined) updateData.minQuantity = input.minQuantity;
    if (input.autoClose !== undefined) updateData.autoClose = input.autoClose;
    if (input.pauseAllowed !== undefined) updateData.pauseAllowed = input.pauseAllowed;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.availableFrom !== undefined) {
      updateData.availableFrom = input.availableFrom ? new Date(input.availableFrom) : null;
    }
    if (input.availableUntil !== undefined) {
      updateData.availableUntil = input.availableUntil ? new Date(input.availableUntil) : null;
    }

    return prisma.plan.update({
      where: { id },
      data: updateData,
    });
  }

  static async deletePlan(id: string) {
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan || plan.deletedAt !== null) {
      throw new NotFoundError(`Plan with ID '${id}' not found`);
    }

    return prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ===================== PRICING CALCULATOR =====================

  static async calculatePrice(input: CalculatePriceInput) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });

    if (!product || product.deletedAt !== null || !product.isAvailable) {
      throw new NotFoundError(`Product '${input.productId}' is not available`);
    }

    let variants: Array<{
      id: string;
      attributeName: string;
      attributeValue: string;
      priceAdjustment: Prisma.Decimal;
    }> = [];

    if (input.variantIds && input.variantIds.length > 0) {
      variants = await prisma.productVariant.findMany({
        where: {
          id: { in: input.variantIds },
          productId: input.productId,
          deletedAt: null,
          isAvailable: true,
        },
        select: {
          id: true,
          attributeName: true,
          attributeValue: true,
          priceAdjustment: true,
        },
      });

      if (variants.length !== input.variantIds.length) {
        throw new BadRequestError('One or more selected variants are invalid or unavailable');
      }
    }

    const basePrice = new Prisma.Decimal(product.salesPrice);
    const sumAdjustments = variants.reduce(
      (acc, v) => acc.plus(v.priceAdjustment),
      new Prisma.Decimal(0),
    );
    const unitPrice = roundMoney(basePrice.plus(sumAdjustments));

    if (unitPrice.lessThan(0)) {
      throw new BadRequestError('Calculated unit price cannot be negative');
    }

    const subtotal = multiplyMoney(unitPrice, input.quantity);

    return {
      productId: product.id,
      productName: product.name,
      basePrice: basePrice.toFixed(2),
      variants: variants.map((v) => ({
        id: v.id,
        attributeName: v.attributeName,
        attributeValue: v.attributeValue,
        priceAdjustment: v.priceAdjustment.toFixed(2),
      })),
      sumAdjustments: sumAdjustments.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      quantity: input.quantity,
      subtotal: subtotal.toFixed(2),
    };
  }
}
