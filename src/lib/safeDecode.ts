/** `decodeURIComponent` that returns the input unchanged when it is not valid percent-encoding (instead of throwing). */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
