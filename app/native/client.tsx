'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import scribe, { type OcrPage, type OcrPar } from 'scribe.js-ocr';

import { Skeleton } from '@/components/ui/skeleton';
import { VisibilityControl } from '@/components/ui/visibility-control';
import { PDFDocument, rgb } from 'pdf-lib';
import { ChangeEvent, useEffect, useState } from 'react';
import { debounce } from 'lodash';
import { proxy, subscribe, useSnapshot } from 'valtio';
import memoize from 'memoizee';
import { hash } from 'ohash';
import { interval } from 'rxjs';

export const memoedRecognize = memoize(
  // Its important to add _buf as the first argument to normalize the arguments and memoize it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_buf: ArrayBuffer) => scribe.recognize(),
  {
    promise: true,
    max: 4,
    maxAge: 1000 * 60 * 5,
    normalizer(args) {
      return hash(args[0]);
    },
  }
);

class PdfAppStore {
  ocrPages: Array<OcrPage> = [];
  original?: ArrayBuffer;
  public?: ArrayBufferLike;
  status: 'idle' | 'ocr-preprocessing' | 'ready' = 'idle';
  durationMs: number = 0;

  constructor() {
    console.log('PdfStore_constructor');
  }

  async loadPdf(buffer: ArrayBuffer) {
    this.original = buffer;
    this.status = 'ocr-preprocessing';
    console.group(['PdfStore_loadPdf', hash(buffer)].join('_'));
    console.time('loadPdf');
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    await scribe.extractText({ pdfFiles: [buffer] }, ['eng']);
    // await scribe.init();
    // await scribe.importFiles({ pdfFiles: [buffer] });
    // const results = await memoedRecognize(buffer);
    const end = Date.now();
    this.durationMs = end - start;
    console.timeEnd('loadPdf');
    console.groupEnd();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    this.ocrPages.splice(0, this.ocrPages.length, ...scribe.data.ocr.active);
    this.status = 'ready';
  }

  async searchPdfByPhrase(phrase: string) {
    if (!this.original) throw new Error('No pdf loaded');
    if (!this.ocrPages) throw new Error('No ocr pages loaded');
    if (phrase.length < 1) return;
    const pdfDoc = await PDFDocument.load(this.original);

    const words = phrase.split(' ');
    this.ocrPages.forEach((page) => {
      const match: Array<unknown> = [];
      for (const paragraph of page.pars) {
        for (const lines of paragraph.lines) {
          for (const word of lines.words) {
            const wordToCheck = words.at(match.length);

            const isSame = wordToCheck
              ? word.text.toLowerCase().includes(wordToCheck?.toLowerCase())
              : false;

            if (isSame) {
              match.push(word);
            } else {
              match.splice(0, match.length);
            }

            if (match.length === words.length) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              match.forEach((matchedWord: any) => {
                const page = matchedWord.line.page;
                const pageFound = pdfDoc.getPage(page.n);
                const scale = {
                  x: page.dims.width / pageFound.getWidth(),
                  y: page.dims.height / pageFound.getHeight(),
                };

                const bottom = matchedWord.bbox.bottom / scale.y;
                const left = matchedWord.bbox.left / scale.x;
                const right = matchedWord.bbox.right / scale.x;
                const top = matchedWord.bbox.top / scale.y;
                pageFound.moveTo(0, pageFound.getHeight());
                pageFound.moveDown(top);
                pageFound.moveRight(left);
                pageFound.drawRectangle({
                  width: right - left,
                  height: top - bottom,
                  color: rgb(1, 1, 0),
                  opacity: 0.5,
                });
              });
              match.splice(0, match.length);
            }
          }
        }
      }
    });

    const result = await pdfDoc.save();
    this.public = result.buffer;
    return result;
  }

  async searchPdfByCharacterPosition(position: number) {
    if (!this.original) throw new Error('No pdf loaded');
    if (!this.ocrPages) throw new Error('No ocr pages loaded');
    if (position < 0) throw new Error('Invalid position');
    const pdfDoc = await PDFDocument.load(this.original);
    const paragraphGenerator = this.forEachDocumentChunk();

    let selected: OcrPar | null = null;
    let lastPosition = 0;
    for (const paragraph of paragraphGenerator()) {
      const maxCursor = lastPosition + paragraph.textContent.length;

      if (position < maxCursor) {
        selected = paragraph;
        // found the paragraph. break the loop
        break;
      }

      lastPosition = maxCursor;
    }

    if (!selected) return;
    const _page = selected.page;
    const pageFound = pdfDoc.getPage(_page.n);
    const scale = {
      x: _page.dims.width / pageFound.getWidth(),
      y: _page.dims.height / pageFound.getHeight(),
    };

    const bottom = selected.bbox.bottom / scale.y;
    const left = selected.bbox.left / scale.x;
    const right = selected.bbox.right / scale.x;
    const top = selected.bbox.top / scale.y;
    pageFound.moveTo(0, pageFound.getHeight());
    pageFound.moveDown(top);
    pageFound.moveRight(left);
    pageFound.drawRectangle({
      width: right - left,
      height: top - bottom,
      color: rgb(1, 1, 0),
      opacity: 0.5,
    });

    const result = await pdfDoc.save();
    this.public = result.buffer;
    return result;
  }

  forEachDocumentChunk = () => {
    const pages = this.ocrPages;
    if (!pages) throw new Error('No ocr pages loaded');

    return function* () {
      for (const page of pages) {
        for (const paragraph of page.pars) {
          const textContent = paragraph.lines
            .map((ocrPara) => {
              return ocrPara.words.map((word) => word.text).join(' ');
            })
            .join(' ');

          yield {
            ...paragraph,
            textContent,
          };
        }
      }
    };
  };

  get maxPosition() {
    if (!this.ocrPages) return 0;
    const paragraphs = this.forEachDocumentChunk()();
    if (!paragraphs) return 0;

    let position = 0;
    for (const paragraph of paragraphs) {
      position += paragraph.textContent.length;
    }

    return position;
  }
}

export const pdfStore = proxy(new PdfAppStore());

subscribe(pdfStore.ocrPages, () => {
  if (!pdfStore.ocrPages) return;
  console.group('PdfStore_subscribe');

  let position = 0;
  const paragraphs = pdfStore.forEachDocumentChunk()();

  for (const paragraph of paragraphs) {
    const endPosition = position + paragraph.textContent.length;
    console.log(
      `Page ${paragraph.page.n + 1}, Position: ${position} - ${endPosition}`
    );
    position = endPosition;
  }

  console.groupEnd();
});

const handleSearchTerm = debounce(
  (phrase: string) => pdfStore.searchPdfByPhrase(phrase),
  500
);

function LoadPdfField({ onChange }: { onChange: (pdf: ArrayBuffer) => void }) {
  return (
    <div className='flex flex-col gap-y-2'>
      <Label htmlFor='pdf'>Load a pdf</Label>
      <Input
        id='pdf'
        type='file'
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onChange(await file.arrayBuffer());
        }}
      />
    </div>
  );
}

export function SearchPdfField() {
  const [searchTerm, setSearchTerm] = useState('');
  const store = useSnapshot(pdfStore);
  const handleTextChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value);
    handleSearchTerm(evt.target.value);
  };

  return (
    <div className='flex flex-1 flex-col gap-y-2'>
      <VisibilityControl
        className='flex flex-col gap-2'
        visible={store.status === 'ocr-preprocessing'}
      >
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
      </VisibilityControl>
      <VisibilityControl visible={store.status === 'ready'}>
        <Label htmlFor='search'>Search</Label>
        <Input
          id='search'
          type='text'
          value={searchTerm}
          onChange={handleTextChange}
        />
      </VisibilityControl>
    </div>
  );
}

export function Form({ children }: { children: React.ReactNode }) {
  const snap = useSnapshot(pdfStore);
  const handleExtraction = async (buffer: ArrayBuffer) => {
    delete pdfStore.public;
    await pdfStore.loadPdf(buffer);
  };

  return (
    <div className='flex gap-4 justify-between px-5 items-center'>
      <LoadPdfField onChange={handleExtraction} />
      <OcrTimer key={hash(snap.original)} />
      {children}
    </div>
  );
}

export function PdfViewer() {
  const store = useSnapshot(pdfStore);
  const buffer = store.public ?? store.original;

  if (!buffer) return null;

  const source = [
    'data:application/pdf;base64,',
    Buffer.from(buffer).toString('base64'),
  ].join('');
  return <iframe src={source} className='w-full h-full' />;
}

export function OcrTimer() {
  const [ms, setMs] = useState(0);
  const snap = useSnapshot(pdfStore);
  const isProcessing = snap.status === 'ocr-preprocessing';

  useEffect(() => {
    if (!isProcessing) return;

    const everyHundredMs$ = interval(100);
    const subscription = everyHundredMs$.subscribe((index) => {
      setMs(index * 100);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isProcessing]);

  return (
    <div className='relative'>
      <div className='inline-flex flex-col items-center justify-center rounded-full bg-gray-800 text-white p-2 w-14 h-14'>
        <span className='font-semibold'>{(ms / 1000).toFixed(1)}s</span>
      </div>
      <div
        data-processing={isProcessing}
        className='absolute data-[processing=true]:animate-spin top-0 w-14 h-14 rounded-full border-t-4 border-teal-400'
      ></div>
    </div>
  );
}
