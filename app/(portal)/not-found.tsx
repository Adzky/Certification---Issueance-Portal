import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

/** 404 inside the portal frame (keeps the sidebar and "Switch Role" available). */
export default function PortalNotFound() {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="This page does not exist or is not available yet."
        action={
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
