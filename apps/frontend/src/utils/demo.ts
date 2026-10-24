export const DEMO_EMAIL_DOMAIN = '@demo.tradelink';

/** Visitor accounts created by "Entrar como visitante". */
export function isDemoUser(email: string | undefined): boolean {
  return !!email && email.endsWith(DEMO_EMAIL_DOMAIN);
}
