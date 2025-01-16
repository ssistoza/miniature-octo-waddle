'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { atom, useAtom } from 'jotai';

import scribe from 'scribe.js-ocr';

import { Skeleton } from '@/components/ui/skeleton';
import { VisibilityControl } from '@/components/ui/visibility-control';
import { PDFDocument, rgb } from 'pdf-lib';
import { atomWithDebounce } from '@/lib/utils';

const uploadedPdfAtom = atom<ArrayBuffer | null>(null);
const searchAtom = atomWithDebounce('');
const ocrAtom = atom(null);
const highlightedPdfAtom = atom(async (get) => {
  const pdf = get(uploadedPdfAtom);
  const search = get(searchAtom.debouncedValueAtom);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = get(ocrAtom) as unknown as Array<any>;
  const words = search.split(' ');
  if (!pdf || search.length < 1 || !pages) return null;
  const pdfDoc = await PDFDocument.load(pdf);

  pages.forEach((page) => {
    const match: Array<unknown> = [];
    for (const paragraph of page.pars) {
      for (const lines of paragraph.lines) {
        for (const word of lines.words) {
          const wordToCheck = words.at(match.length);
          const isSame = word.text
            .toLowerCase()
            .includes(wordToCheck?.toLowerCase());

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

  return await pdfDoc.save();
});
const statusAtom = atom(async (get) => {
  const pdf = get(uploadedPdfAtom);
  if (!pdf) return 'idle';
  if (!get(ocrAtom)) return 'ocr-preprocessing';
  return 'ready';
});
const pdfAtom = atom(async (get) => {
  const pdf = await get(highlightedPdfAtom);
  return pdf || get(uploadedPdfAtom);
});

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

function SearchPdfField() {
  const [, setSearch] = useAtom(searchAtom.debouncedValueAtom);
  const [search] = useAtom(searchAtom.currentValueAtom);
  const [status] = useAtom(statusAtom);
  const isLoading = status === 'ocr-preprocessing';

  if (isLoading) {
    return <Skeleton className='h-4 w-full' />;
  }

  return (
    <>
      <Label htmlFor='search'>Search</Label>
      <Input
        id='search'
        type='text'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </>
  );
}

export function Form() {
  const [pdf, setPdf] = useAtom(uploadedPdfAtom);
  const [, setOcr] = useAtom(ocrAtom);

  const handleExtraction = async (buffer: ArrayBuffer) => {
    setPdf(buffer);

    await scribe.init();
    await scribe.importFiles({ pdfFiles: [buffer] });
    const pages = await scribe.recognize();
    setOcr(pages);
  };

  return (
    <div className='grid w-full max-w-sm items-center gap-1.5'>
      <VisibilityControl visible={!pdf}>
        <LoadPdfField onChange={handleExtraction} />
      </VisibilityControl>
      <VisibilityControl visible={Boolean(pdf)}>
        <SearchPdfField />
      </VisibilityControl>
    </div>
  );
}

export function PdfViewer() {
  const [pdf] = useAtom(pdfAtom);

  if (!pdf) return null;
  return (
    <iframe
      src={`data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}`}
      className='w-full h-full'
    />
  );
}
