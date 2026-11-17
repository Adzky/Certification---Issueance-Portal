/** Public verification URL for a certificate number (shared by services and UI). */
export function verificationUrl(certNo: string, baseUrl: string): string {
  return `${baseUrl}/verify/${certNo}`;
}
