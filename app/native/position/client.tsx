'use client';
import { useSnapshot } from 'valtio';
import { pdfStore } from '../client';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { useState } from 'react';

export function CursorSelectionField() {
  const snap = useSnapshot(pdfStore);
  const [cursorPosition, setCursorPosition] = useState(0);
  const isLoading = snap.status === 'ocr-preprocessing';

  if (isLoading) {
    return <Skeleton className='h-4 w-full' />;
  }

  return (
    <>
      <div className='absolute top-2 left-2 p-4 rounded-full bg-slate-500 text-slate-50'>
        <div>Max Positions: {snap.maxPosition}</div>
      </div>

      <div className='flex flex-col gap-2'>
        <span className='text-sm '>
          Select Cursor Position: {cursorPosition}
        </span>
        <Slider
          max={snap.maxPosition}
          step={1}
          onChange={async (evt) => {
            const value = parseInt((evt.target as HTMLInputElement).value);
            setCursorPosition(value);
            await pdfStore.searchPdfByCharacterPosition(value);
          }}
        />
      </div>
    </>
  );
}
