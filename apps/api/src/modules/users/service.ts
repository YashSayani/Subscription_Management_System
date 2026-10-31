import bcrypt from 'bcrypt';
import { prisma, Role } from '@brightloop/database';
import { ConflictError } from '../../common/errors.js';
import { CreateStaffInput, UserQueryInput } from './schema.js';

const SALT_ROUNDS = 12;

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

  const where = {
    deletedAt: null,
    ...(query.role && { role: query.role as Role }),
  };

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
    users,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};
