import { notFound } from 'next/navigation';
import { NAV } from '@/domain/nav';
import { StubPage } from './StubPage';

/** Stub nav items ("Available in full release"); any other unknown portal path is a 404. */
export default async function StubRoute({ params }: { params: Promise<{ stub: string[] }> }) {
  const { stub } = await params;
  const pathname = `/${stub.join('/')}`;
  const isStub = Object.values(NAV).some((items) => items.some((i) => i.stub && i.href === pathname));
  if (!isStub) notFound();
  return <StubPage pathname={pathname} />;
}
