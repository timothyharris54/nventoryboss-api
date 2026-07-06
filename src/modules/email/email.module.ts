import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Module({
  providers: [
    EmailService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => {
        const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

        if (!provider || provider === 'console') {
          return new ConsoleEmailProvider();
        }

        if (provider === 'resend') {
          return new ResendEmailProvider();
        }

        throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
