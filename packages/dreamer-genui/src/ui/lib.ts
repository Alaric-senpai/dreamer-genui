/** Tiny class combiner for the host-only kit (no Tailwind dependency). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
