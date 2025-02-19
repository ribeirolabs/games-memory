export function array<T>(lenght: number, map: (i: number) => T): T[] {
  return Array.from({ length }, (_, i) => map(i));
}
