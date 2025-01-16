import { Form, PdfViewer } from './client';
import { Suspense } from 'react';

export default function Page() {
  return (
    <main className='grid grid-cols-5 grid-rows-5 gap-0 h-screen'>
      <form className='place-content-center row-span-1 col-span-5 flex'>
        <Form />
      </form>
      <div className='row-span-4 col-span-5'>
        <Suspense>
          <PdfViewer />
        </Suspense>
      </div>
    </main>
  );
}
