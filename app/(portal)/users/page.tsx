import { Suspense } from 'react';
import { UsersView } from '@/components/users/UsersView';

export default function UsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
