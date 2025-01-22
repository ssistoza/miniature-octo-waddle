'use client';
import { Label } from '@/components/ui/label';
import { useSnapshot } from 'valtio';
import { pdfStore } from '../client';
import { Skeleton } from '@/components/ui/skeleton';

export function CursorSelectionField() {
  const snap = useSnapshot(pdfStore);
  const isLoading = snap.status === 'ocr-preprocessing';

  if (isLoading) {
    return <Skeleton className='h-4 w-full' />;
  }

  return (
    <div className='flex flex-col'>
      <Label>Cursor Selection</Label>
      <div>{snap.maxPosition}</div>
    </div>
  );
}
