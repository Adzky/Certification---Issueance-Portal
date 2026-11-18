/** Public verification URL for a certificate number (shared by services and UI). */
export function verificationUrl(certNo: string, baseUrl: string): string {
  return `${baseUrl}/verify/${certNo}`;
}

/**
 * Base URL used in certificate QR codes and verification links: the configured public URL
 * (env `PUBLIC_BASE_URL`) when set, otherwise the origin of the current request.
 */
export function publicBaseUrl(configured: string | undefined, requestOrigin: string): string {
  const base = (configured ?? '').trim().replace(/\/+$/, '');
  return base || requestOrigin;
}
