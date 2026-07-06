import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  DEFAULT_PASSWORD_MIN_LENGTH,
  PasswordPolicyService,
} from './password-policy.service';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;

  const prismaMock = {
    accountSecuritySettings: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordPolicyService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('uses the default password minimum when account settings do not exist', async () => {
    prismaMock.accountSecuritySettings.findUnique.mockResolvedValue(null);

    await expect(
      service.getPasswordMinLength(1n),
    ).resolves.toBe(DEFAULT_PASSWORD_MIN_LENGTH);
  });

  it('uses the account configured password minimum when present', async () => {
    prismaMock.accountSecuritySettings.findUnique.mockResolvedValue({
      passwordMinLength: 16,
    });

    await expect(service.getPasswordMinLength(1n)).resolves.toBe(16);
  });

  it('rejects passwords shorter than the account policy', async () => {
    prismaMock.accountSecuritySettings.findUnique.mockResolvedValue({
      passwordMinLength: 16,
    });

    await expect(
      service.assertPasswordMeetsAccountPolicy(1n, 'short-password'),
    ).rejects.toThrow(BadRequestException);
  });
});
