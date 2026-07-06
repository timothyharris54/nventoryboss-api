import { AuthPasswordService } from './auth-password.service';

describe('AuthPasswordService', () => {
  let service: AuthPasswordService;

  beforeEach(() => {
    service = new AuthPasswordService();
  });

  it('hashes passwords and verifies only the matching password', async () => {
    const hash = await service.hashPassword('correct-password');

    await expect(
      service.verifyPassword('correct-password', hash),
    ).resolves.toBe(true);
    await expect(service.verifyPassword('wrong-password', hash)).resolves.toBe(
      false,
    );
    expect(hash).toMatch(/^scrypt\$/);
  });

  it('rejects unsupported password hash formats', async () => {
    await expect(
      service.verifyPassword('correct-password', 'legacy-hash'),
    ).resolves.toBe(false);
  });
});
