import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import type { EmailMessage } from '../interfaces/email-message.interface';
import type { EmailProvider } from '../interfaces/email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.');
    }

    if (!from) {
      throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=resend.');
    }

    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }
  }
}
