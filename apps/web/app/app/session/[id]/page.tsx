'use client';

import { use } from 'react';
import { SessionRunner } from '@/components/voting/SessionRunner';

/** P-07. */
const SessionPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return <SessionRunner sessionId={id} />;
};

export default SessionPage;
