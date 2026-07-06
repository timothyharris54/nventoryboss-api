import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

export const DEFAULT_PASSWORD_MIN_LENGTH = 12;

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPasswordMeetsAccountPolicy(
    accountId: bigint,
    password: string,
  ): Promise<void> {
    const minLength = await this.getPasswordMinLength(accountId);

    if (password.length < minLength) {
      throw new BadRequestException(
        `Password must be at least ${minLength} characters.`,
      );
    }
  }

  async getPasswordMinLength(accountId: bigint): Promise<number> {
    const settings = await this.prisma.accountSecuritySettings.findUnique({
      where: { accountId },
      select: { passwordMinLength: true },
    });

    return settings?.passwordMinLength ?? DEFAULT_PASSWORD_MIN_LENGTH;
  }
}
