import type { EmailMessage } from './email-message.interface';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
