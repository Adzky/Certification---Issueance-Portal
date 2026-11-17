import QRCode from 'qrcode';
import { renderToBuffer } from '@react-pdf/renderer';
import { verificationUrl } from '@/domain/verification';
import { withActor } from '@/server/handler';
import { getCertificate } from '@/services/certificates';
import { getDocument } from '@/services/documents';
import { CertificatePdf } from '@/components/documents/CertificatePdf';

export const runtime = 'nodejs';

/** The issued certificate / inspection report as a PDF with the verification QR code. */
export const GET = withActor<{ id: string }>(async (actor, req, { params }) => {
  const cert = await getCertificate(actor, params.id);
  const doc = await getDocument(actor, cert.documentId);
  const url = verificationUrl(cert.number, new URL(req.url).origin);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 280, errorCorrectionLevel: 'M' });
  const buffer = await renderToBuffer(
    CertificatePdf({
      type: cert.type,
      number: cert.number,
      clientName: cert.clientName,
      clientAddress: cert.clientAddress,
      fields: doc.fields,
      issueDate: cert.issueDate,
      validUntil: cert.validUntil,
      qrDataUrl,
      verificationUrl: url,
    }),
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${cert.number}.pdf"`,
      'cache-control': 'private, no-store',
    },
  });
});
