export const normalizeUserId = (id: string | null | undefined) => (id ?? '').trim().toLowerCase();

export const sameUserId = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normalizeUserId(a);
  const nb = normalizeUserId(b);
  return na.length > 0 && na === nb;
};
