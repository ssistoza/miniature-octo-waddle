'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import scribe, { type OcrPage, type OcrPar } from 'scribe.js-ocr';

import { Skeleton } from '@/components/ui/skeleton';
import { VisibilityControl } from '@/components/ui/visibility-control';
import { PDFDocument, rgb } from 'pdf-lib';
import { ChangeEvent, useState } from 'react';
import { debounce } from 'lodash';
import { proxy, subscribe, useSnapshot } from 'valtio';

class PdfAppStore {
  ocrPages?: Array<OcrPage>;
  original?: ArrayBuffer;
  public?: ArrayBufferLike;
  status: 'idle' | 'ocr-preprocessing' | 'ready' = 'idle';

  async loadPdf(buffer: ArrayBuffer) {
    this.original = buffer;
    this.status = 'ocr-preprocessing';
    await scribe.init();
    await scribe.importFiles({ pdfFiles: [buffer] });
    this.ocrPages = await scribe.recognize();
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

    const index = 0;
    let selected: OcrPar | null = null;
    for (const paragraph of paragraphGenerator()) {
      const maxCursor = index + paragraph.textContent.length;

      if (position > maxCursor) {
        // found the paragraph. break the loop
        break;
      }
      selected = paragraph;
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
          yield {
            ...paragraph,
            textContent: paragraph.lines
              .map((ocrPara) => {
                return ocrPara.words.map((word) => word.text).join(' ');
              })
              .join(' '),
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
const handleSearchTerm = debounce(pdfStore.searchPdfByPhrase, 500);

function LoadPdfField({ onChange }: { onChange: (pdf: ArrayBuffer) => void }) {
  return (
    <>
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
    </>
  );
}

export function SearchPdfField() {
  const [searchTerm, setSearchTerm] = useState('');
  const store = useSnapshot(pdfStore);
  const isLoading = store.status === 'ocr-preprocessing';
  const handleTextChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value);
    handleSearchTerm(evt.target.value);
  };

  if (isLoading) {
    return <Skeleton className='h-4 w-full' />;
  }

  return (
    <>
      <Label htmlFor='search'>Search</Label>
      <Input
        id='search'
        type='text'
        value={searchTerm}
        onChange={handleTextChange}
      />
    </>
  );
}

export function Form({ children }: { children: React.ReactNode }) {
  const store = useSnapshot(pdfStore);
  const pdfLoaded = Boolean(store.original);

  const handleExtraction = async (buffer: ArrayBuffer) =>
    pdfStore.loadPdf(buffer);

  return (
    <div className='grid w-full max-w-sm items-center gap-1.5'>
      <VisibilityControl visible={!pdfLoaded}>
        <LoadPdfField onChange={handleExtraction} />
      </VisibilityControl>
      <VisibilityControl visible={pdfLoaded}>{children}</VisibilityControl>
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
