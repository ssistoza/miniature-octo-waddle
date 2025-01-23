import { Suspense } from 'react';
import { Form, PdfViewer } from '../client';
import { CursorSelectionField } from './client';

export default function Page() {
  return (
    <main className='grid grid-cols-5 grid-rows-8 gap-0 h-screen'>
      <form className='place-content-center row-span-1 col-span-5'>
        <Form>
          <CursorSelectionField />
        </Form>
      </form>
      <div className='row-span-7 col-span-5'>
        <Suspense>
          <PdfViewer />
        </Suspense>
      </div>
    </main>
  );
}
