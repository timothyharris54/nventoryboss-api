import { EmailService } from './email.service';
import type { EmailProvider } from './interfaces/email-provider.interface';

describe('EmailService', () => {
  it('sends initial credentials in a welcome email from the requested sender', async () => {
    const provider: jest.Mocked<EmailProvider> = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmailService(provider);

    await service.sendWelcomeEmail({
      to: 'admin@acme.com',
      fullName: 'Jane <Smith>',
      accountName: 'Acme & Co',
      password: 'secure-password',
    });

    expect(provider.send).toHaveBeenCalledWith({
      from: 'info@NVentoryBoss.com',
      to: 'admin@acme.com',
      subject: 'Welcome to NVentory Boss',
      text: expect.stringContaining('Password: secure-password'),
      html: expect.stringContaining('Jane &lt;Smith&gt;'),
    });
  });
});
