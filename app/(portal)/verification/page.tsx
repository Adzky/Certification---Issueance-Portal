import { Suspense } from 'react';
import { ReviewListView } from '@/components/review/ReviewListView';

export default function VerificationPage() {
  return (
    <Suspense>
      <ReviewListView mode="verification" />
    </Suspense>
  );
}
