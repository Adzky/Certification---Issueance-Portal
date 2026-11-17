const pad = (n: number) => String(n).padStart(4, '0');

export function requestNumber(year: number, seq: number): string {
  return `REQ-${year}-${pad(seq)}`;
}

export function draftNumber(year: number, seq: number): string {
  return `DRF-${year}-${pad(seq)}`;
}

export function certificateNumber(schemeCode: string, year: number, seq: number): string {
  return `JMU-${schemeCode}-${year}-${pad(seq)}`;
}

export function sequenceKey(kind: 'REQ' | 'DRF' | 'CERT', year: number, schemeCode?: string): string {
  return kind === 'CERT' ? `CERT-${schemeCode}-${year}` : `${kind}-${year}`;
}
