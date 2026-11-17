import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DocumentType } from '@/domain/types';

export interface CertificatePdfProps {
  type: DocumentType;
  number: string;
  clientName: string;
  clientAddress?: string | null;
  /** Document field values (standard, scope statement, sites, audit date, findings, ...). */
  fields: Record<string, string>;
  issueDate: string;
  validUntil: string;
  /** PNG data URL of the verification QR code. */
  qrDataUrl: string;
  verificationUrl: string;
}

const NAVY = '#0b1f4d';
const BLUE = '#1d4ed8';
const GOLD = '#c9a24a';
const GREY = '#475569';

// Built-in Helvetica family only: no font downloads.
const s = StyleSheet.create({
  page: { padding: 22, fontFamily: 'Helvetica', color: '#0f172a', backgroundColor: '#ffffff' },
  outer: { flexGrow: 1, borderWidth: 3, borderColor: BLUE, padding: 4 },
  inner: { flexGrow: 1, borderWidth: 1, borderColor: GOLD, paddingHorizontal: 48, paddingVertical: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY },
  brandSub: { fontSize: 8, color: GREY, marginTop: 2 },
  headRight: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  center: { alignItems: 'center', marginTop: 14 },
  title: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 1.5 },
  no: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  small: { fontSize: 11, marginTop: 14 },
  client: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginTop: 6, textAlign: 'center' },
  address: { fontSize: 10, color: GREY, marginTop: 3, textAlign: 'center' },
  standard: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 6, textAlign: 'center' },
  scope: { fontSize: 11, marginTop: 6, textAlign: 'center', maxWidth: 520 },
  meta: { fontSize: 9, color: GREY, marginTop: 8, textAlign: 'center', maxWidth: 560 },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  qrBox: { alignItems: 'flex-start' },
  qr: { width: 70, height: 70 },
  qrCaption: { fontSize: 7, color: GREY, marginTop: 3, maxWidth: 220 },
  sign: { width: 190, alignItems: 'center' },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 3,
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  reportFrame: { flexGrow: 1, borderWidth: 3, borderColor: BLUE, paddingHorizontal: 34, paddingVertical: 26 },
  reportTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingVertical: 7 },
  rowKey: { width: 130, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#334155' },
  rowVal: { flex: 1, fontSize: 10 },
});

const dash = (v: string | undefined | null) => (v && v.trim() ? v : '-');

function fmtDate(v: string | undefined): string {
  if (!v) return '-';
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function Footer({
  qrDataUrl,
  verificationUrl,
  compact,
}: Pick<CertificatePdfProps, 'qrDataUrl' | 'verificationUrl'> & { compact?: boolean }) {
  return (
    <View style={s.footer}>
      <View style={s.qrBox}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
        <Image src={qrDataUrl} style={compact ? { width: 60, height: 60 } : s.qr} />
        <Text style={s.qrCaption}>Scan to verify: {verificationUrl}</Text>
      </View>
      <View style={s.sign}>
        <View style={{ height: 36 }} />
        <Text style={s.signLine}>Certification Director</Text>
      </View>
    </View>
  );
}

function CertificatePage(p: CertificatePdfProps) {
  const f = p.fields;
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.outer}>
        <View style={s.inner}>
          <View style={s.header}>
            <View>
              <Text style={s.brand}>JMU SERTIFIKASI</Text>
              <Text style={s.brandSub}>Certification &amp; Issuance Portal</Text>
            </View>
            <Text style={s.headRight}>{'Management System\nCertification'}</Text>
          </View>
          <View style={s.center}>
            <Text style={s.title}>CERTIFICATE</Text>
            <Text style={s.no}>No. {p.number}</Text>
            <Text style={s.small}>This is to certify that</Text>
            <Text style={s.client}>{p.clientName}</Text>
            {p.clientAddress ? <Text style={s.address}>{p.clientAddress}</Text> : null}
            <Text style={[s.small, { marginTop: 10 }]}>has been assessed and found to conform to the requirements of</Text>
            <Text style={s.standard}>{dash(f.standard)}</Text>
            <Text style={s.scope}>{dash(f.scopeStatement)}</Text>
            <Text style={s.meta}>
              Sites: {dash(f.sites)} | Audit date: {fmtDate(f.auditDate)}
            </Text>
            <Text style={s.meta}>
              Issued: {fmtDate(p.issueDate)} | Valid until: {fmtDate(p.validUntil)}
            </Text>
          </View>
          <Footer qrDataUrl={p.qrDataUrl} verificationUrl={p.verificationUrl} />
        </View>
      </View>
    </Page>
  );
}

function ReportPage(p: CertificatePdfProps) {
  const f = p.fields;
  const rows: [string, string][] = [
    ['Client', p.clientName],
    ['Inspected object', dash(f.objectDescription)],
    ['Inspection location', dash(f.inspectionLocation)],
    ['Inspection date', fmtDate(f.inspectionDate)],
    ['Inspection method', dash(f.method)],
    ['Findings', dash(f.findings)],
    ['Conclusion', dash(f.conclusion)],
    ['Issued', fmtDate(p.issueDate)],
    ['Valid until', fmtDate(p.validUntil)],
  ];
  return (
    <Page size="A4" style={s.page}>
      <View style={s.reportFrame}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>JMU SERTIFIKASI</Text>
            <Text style={s.brandSub}>Certification &amp; Issuance Portal</Text>
          </View>
          <Text style={s.headRight}>Inspection Report</Text>
        </View>
        <View style={s.center}>
          <Text style={s.reportTitle}>INSPECTION REPORT</Text>
          <Text style={s.no}>No. {p.number}</Text>
        </View>
        <View style={{ marginTop: 22, flexGrow: 1 }}>
          {rows.map(([k, v]) => (
            <View key={k} style={s.row} wrap={false}>
              <Text style={s.rowKey}>{k}</Text>
              <Text style={s.rowVal}>{v}</Text>
            </View>
          ))}
        </View>
        <Footer qrDataUrl={p.qrDataUrl} verificationUrl={p.verificationUrl} compact />
      </View>
    </Page>
  );
}

/** Issued certificate (A4 landscape) or inspection report (A4 portrait) as a react-pdf document. */
export function CertificatePdf(props: CertificatePdfProps) {
  return (
    <Document title={`${props.type === 'CERTIFICATE' ? 'Certificate' : 'Inspection Report'} ${props.number}`} author="JMU Sertifikasi">
      {props.type === 'CERTIFICATE' ? <CertificatePage {...props} /> : <ReportPage {...props} />}
    </Document>
  );
}
