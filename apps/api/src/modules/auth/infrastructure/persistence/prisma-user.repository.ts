import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { User } from '../../model/entity/user';
import type { UserRepository } from '../../repository/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        employeeId: true,
        email: true,
        passwordHash: true,
        role: true,
        employee: { select: { status: true } },
      },
    });

    return user === null
      ? null
      : {
          id: user.id,
          employeeId: user.employeeId,
          email: user.email,
          passwordHash: user.passwordHash,
          role: user.role,
          employeeStatus: user.employee?.status ?? null,
        };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        email: true,
        passwordHash: true,
        role: true,
        employee: { select: { status: true } },
      },
    });

    return user === null
      ? null
      : {
          id: user.id,
          employeeId: user.employeeId,
          email: user.email,
          passwordHash: user.passwordHash,
          role: user.role,
          employeeStatus: user.employee?.status ?? null,
        };
  }
}
