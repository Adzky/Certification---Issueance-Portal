import { DraftEditorView } from '@/components/documents/DraftEditorView';

export default async function EditDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DraftEditorView id={id} />;
}
