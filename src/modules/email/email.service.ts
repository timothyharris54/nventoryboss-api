import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from './interfaces/email-provider.interface';
import { buildPasswordResetEmail } from './templates/password-reset-email.template';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: EmailProvider,
  ) {}

  async sendPasswordResetEmail(input: {
    to: string;
    token: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const resetUrl = this.buildPasswordResetUrl(input.token);
    const email = buildPasswordResetEmail({
      resetUrl,
      expiresInMinutes: input.expiresInMinutes,
    });

    await this.provider.send({
      to: input.to,
      ...email,
    });
  }

  private buildPasswordResetUrl(token: string): string {
    const configuredBaseUrl =
      process.env.PASSWORD_RESET_URL_BASE?.trim() ||
      buildDefaultResetUrlBase(process.env.APP_BASE_URL?.trim());

    if (!configuredBaseUrl) {
      throw new Error(
        'PASSWORD_RESET_URL_BASE or APP_BASE_URL is required to send password reset emails.',
      );
    }

    const resetUrl = new URL(configuredBaseUrl);
    resetUrl.searchParams.set('token', token);
    return resetUrl.toString();
  }
}

function buildDefaultResetUrlBase(appBaseUrl?: string): string | null {
  if (!appBaseUrl) {
    return process.env.NODE_ENV === 'production'
      ? null
      : 'http://localhost:5173/reset-password';
  }

  return new URL('/reset-password', appBaseUrl).toString();
}
