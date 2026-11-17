import { PortalShell } from '@/components/shell/PortalShell';

/**
 * Portal frame for every signed-in page. Access per role is enforced before rendering by
 * the root `proxy.ts` (`allowedPaths`, ruling R5), so this layout imports no server code.
 */
export default function PortalLayout({ children }: LayoutProps<'/'>) {
  return <PortalShell>{children}</PortalShell>;
}
