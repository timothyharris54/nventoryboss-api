export function buildPasswordResetEmail(input: {
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const escapedResetUrl = escapeHtml(input.resetUrl);
  const subject = 'Reset your StockPilot password';
  const text = [
    'We received a request to reset your StockPilot password.',
    '',
    `Use this link within ${input.expiresInMinutes} minutes:`,
    input.resetUrl,
    '',
    'If you did not request a password reset, you can ignore this email.',
  ].join('\n');

  const html = [
    '<p>We received a request to reset your StockPilot password.</p>',
    `<p><a href="${escapedResetUrl}">Reset your password</a></p>`,
    `<p>This link expires in ${input.expiresInMinutes} minutes.</p>`,
    '<p>If you did not request a password reset, you can ignore this email.</p>',
  ].join('');

  return {
    subject,
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
