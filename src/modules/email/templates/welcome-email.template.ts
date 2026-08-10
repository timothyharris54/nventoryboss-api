export function buildWelcomeEmail(input: {
  to: string;
  fullName: string;
  accountName: string;
  password: string;
}) {
  const subject = 'Welcome to NVentory Boss';
  const text = [
    `Hello ${input.fullName},`,
    '',
    `Your administrator account for ${input.accountName} has been created.`,
    '',
    `Email: ${input.to}`,
    `Password: ${input.password}`,
    '',
    'For security, please change your password after signing in.',
  ].join('\n');

  const html = [
    `<p>Hello ${escapeHtml(input.fullName)},</p>`,
    `<p>Your administrator account for ${escapeHtml(input.accountName)} has been created.</p>`,
    '<p>',
    `<strong>Email:</strong> ${escapeHtml(input.to)}<br>`,
    `<strong>Password:</strong> ${escapeHtml(input.password)}`,
    '</p>',
    '<p>For security, please change your password after signing in.</p>',
  ].join('');

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
