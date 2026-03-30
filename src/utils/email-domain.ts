const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.es',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'yandex.com',
  'tutanota.com',
];

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export function isFreemailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.includes(domain.toLowerCase());
}
