/** Decode JWT `sub` (user id) without verifying the signature — same as typical client-side use. */
export function decodeJwtSub(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
    const json = atob(padded);
    const parsed = JSON.parse(json) as { sub?: string };
    return typeof parsed?.sub === 'string' ? parsed.sub : null;
  } catch {
    return null;
  }
}
