import { Suspense } from 'react';
import { ReviewListView } from '@/components/review/ReviewListView';

export default function SigningPage() {
  return (
    <Suspense>
      <ReviewListView mode="signing" />
    </Suspense>
  );
}
