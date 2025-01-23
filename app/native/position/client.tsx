'use client';
import { useSnapshot } from 'valtio';
import { pdfStore } from '../client';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { useState } from 'react';
import { VisibilityControl } from '@/components/ui/visibility-control';

export function CursorSelectionField() {
  const snap = useSnapshot(pdfStore);
  const [cursorPosition, setCursorPosition] = useState(0);

  return (
    <div className='flex flex-1 flex-col gap-y-2'>
      <VisibilityControl
        className='flex flex-col gap-2'
        visible={snap.status === 'ocr-preprocessing'}
      >
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
      </VisibilityControl>
      <VisibilityControl visible={snap.status === 'ready'}>
        <div>Max Positions: {snap.maxPosition}</div>

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
      </VisibilityControl>
    </div>
  );
}
