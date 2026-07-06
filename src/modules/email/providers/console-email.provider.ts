import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage } from '../interfaces/email-message.interface';
import type { EmailProvider } from '../interfaces/email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      [
        `Email queued for ${message.to}`,
        `Subject: ${message.subject}`,
        message.text,
      ].join('\n'),
    );
  }
}
