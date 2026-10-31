import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma, Role, Prisma } from '@brightloop/database';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { formatMoney } from '../../common/money.js';
import {
  CreateStaffInput,
  CreateCustomerInput,
  UserQueryInput,
  UpdateProfileBody,
} from './schema.js';

const SALT_ROUNDS = 12;

export const createCustomerUser = async (
  input: CreateCustomerInput,
  actorId: string,
  actorRole: string,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  // Use provided password or generate a secure temporary password
  const plainPassword =
    input.password && input.password.trim().length > 0
      ? input.password
      : `Bright#${crypto.randomBytes(4).toString('hex')}!`;

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  const initialCreditNum = input.initialCredit && input.initialCredit > 0 ? input.initialCredit : 0;

  const customer = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: Role.CUSTOMER,
      companyName: input.companyName || null,
      taxId: input.taxId || null,
      billingAddress: input.billingAddress || null,
      creditBalance: new Prisma.Decimal(initialCreditNum),
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyName: true,
      taxId: true,
      billingAddress: true,
      creditBalance: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (initialCreditNum > 0) {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: 'PAYMENT_SURPLUS_CREDITED',
        entityType: 'User',
        entityId: customer.id,
        newValues: {
          note: 'Initial account opening credit',
          surplusAmount: initialCreditNum.toFixed(2),
        },
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      actorRole,
      action: 'CUSTOMER_CREATED',
      entityType: 'User',
      entityId: customer.id,
      newValues: {
        email: customer.email,
        fullName: customer.fullName,
        companyName: customer.companyName,
        initialCredit: initialCreditNum.toFixed(2),
      },
    },
  });

  return {
    customer: {
      ...customer,
      creditBalance: formatMoney(customer.creditBalance),
    },
    temporaryPassword: input.password ? undefined : plainPassword,
  };
};

export const createStaffUser = async (input: CreateStaffInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const staffUser = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: Role.STAFF,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return staffUser;
};

export const listUsers = async (query: UserQueryInput) => {
  const skip = (query.page - 1) * query.limit;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role && { role: query.role as Role }),
  };

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { companyName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        companyName: true,
        creditBalance: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    users: users.map((u) => ({
      ...u,
      creditBalance: formatMoney(u.creditBalance),
    })),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyName: true,
      taxId: true,
      billingAddress: true,
      creditBalance: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    throw new NotFoundError('User profile not found');
  }

  return {
    ...user,
    creditBalance: formatMoney(user.creditBalance),
  };
};

export const updateUserProfile = async (userId: string, input: UpdateProfileBody) => {
  const existing = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });

  if (!existing || !existing.isActive) {
    throw new NotFoundError('User profile not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.companyName !== undefined && { companyName: input.companyName }),
      ...(input.taxId !== undefined && { taxId: input.taxId }),
      ...(input.billingAddress !== undefined && { billingAddress: input.billingAddress }),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyName: true,
      taxId: true,
      billingAddress: true,
      creditBalance: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...updated,
    creditBalance: formatMoney(updated.creditBalance),
  };
};

export interface CreditLedgerTransaction {
  id: string;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  reference: string;
  description: string;
}

export const getUserCreditHistory = async (targetUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      email: true,
      companyName: true,
      creditBalance: true,
    },
  });

  if (!user) {
    throw new NotFoundError('Customer not found');
  }

  // 1. Fetch surplus credit audit logs
  const surplusLogs = await prisma.auditLog.findMany({
    where: {
      entityType: 'User',
      entityId: targetUserId,
      action: 'PAYMENT_SURPLUS_CREDITED',
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch payments made with customer credit balance
  const creditPayments = await prisma.payment.findMany({
    where: {
      customerId: targetUserId,
      notes: { contains: 'Settlement via customer credit balance' },
    },
    include: {
      allocations: {
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
            },
          },
        },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });

  const transactions: CreditLedgerTransaction[] = [];

  for (const log of surplusLogs) {
    const details = log.newValues as Record<string, unknown> | null;
    const amount = (details?.surplusAmount as string | number) || '0.00';
    const paymentNum = (details?.paymentNumber as string) || 'N/A';
    transactions.push({
      id: log.id,
      date: log.createdAt.toISOString(),
      type: 'CREDIT',
      amount: formatMoney(amount),
      reference: paymentNum,
      description: `Surplus payment credited from payment ${paymentNum}`,
    });
  }

  for (const p of creditPayments) {
    const invoiceRefs = p.allocations.map((a) => a.invoice.invoiceNumber).join(', ');
    const desc = invoiceRefs
      ? `Credit applied to invoice ${invoiceRefs}`
      : 'Credit settlement applied to open balance';

    transactions.push({
      id: p.id,
      date: p.paymentDate.toISOString(),
      type: 'DEBIT',
      amount: formatMoney(p.amount),
      reference: p.paymentNumber,
      description: desc,
    });
  }

  // Sort chronologically descending
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    customerId: targetUserId,
    customerName: user.fullName,
    customerEmail: user.email,
    creditBalance: formatMoney(user.creditBalance),
    transactions,
  };
};
