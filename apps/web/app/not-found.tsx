import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const NotFound = () => (
  <div className="mx-auto max-w-[720px] px-4 pt-12">
    <EmptyState
      icon="404"
      title="That page isn't here"
      action={
        <Link href="/" className={buttonClass()}>
          Back to start
        </Link>
      }
    >
      The link may be old, or the page moved.
    </EmptyState>
  </div>
);

export default NotFound;
