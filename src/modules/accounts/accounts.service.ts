import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthPasswordService } from 'src/modules/auth/services/auth-password.service';
import { EmailService } from 'src/modules/email/email.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateAccountDto) {
    const passwordHash = await this.authPasswordService.hashPassword(
      dto.initialAdmin.password,
    );

    const account = await this.prisma.$transaction(async (tx) => {
      const accountAdminRole = await tx.role.findUniqueOrThrow({
        where: { code: UserRoleCode.account_admin },
      });

      const account = await tx.account.create({
        data: {
          name: dto.name,
          nextPurchaseOrderNumber: dto.nextPurchaseOrderNumber ?? 1000,
        },
      });

      const initialAdmin = await tx.user.create({
        data: {
          accountId: account.id,
          email: dto.initialAdmin.email,
          fullName: dto.initialAdmin.fullName,
          passwordHash,
          passwordChangedAt: new Date(),
        },
      });

      await tx.userRole.create({
        data: {
          accountId: account.id,
          userId: initialAdmin.id,
          roleId: accountAdminRole.id,
        },
      });

      return account;
    });

    await this.emailService.sendWelcomeEmail({
      to: dto.initialAdmin.email,
      fullName: dto.initialAdmin.fullName,
      accountName: account.name,
      password: dto.initialAdmin.password,
    });

    return account;
  }

  async update(id: bigint, dto: UpdateAccountDto) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        nextPurchaseOrderNumber: dto.nextPurchaseOrderNumber ?? undefined,
      },
    });

    return account;
  }

  async deactivate(id: bigint) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    // Soft-deactivation: deactivate all users and cancel subscription if present
    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { accountId: id },
        data: { isActive: false },
      });

      await tx.accountSubscription.updateMany({
        where: { accountId: id, status: { not: 'cancelled' } },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    });

    return { id };
  }
}
