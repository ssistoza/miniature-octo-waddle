declare module 'scribe.js-ocr' {
  export interface ScribeInstance {
    init(): Promise<void>;
    importFiles({ pdfFiles }: { pdfFiles: ArrayBuffer[] }): Promise<void>;
    recognize(): Promise<Array<OcrPage>>;
  }

  type BBox = {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };

  interface OcrChar {
    text: string;
    bbox: BBox;
  }

  interface OcrWord {
    sup: boolean;
    dropcap: boolean;
    smallCaps: boolean;
    text: string;
    textAlt?: string;
    style: 'normal' | 'bold' | 'italic';
    font?: string;
    size?: number;
    lang: string;
    conf: number;
    bbox: BBox;
    compTruth: boolean;
    matchTruth: boolean;
    id: string;
    line: OcrLine;
    raw?: string;
    chars?: Array<OcrChar>;
    _angleAdj?: { x: number; y: number };
    visualCoords: boolean;
  }

  interface OcrLine {
    bbox: BBox;
    baseline: Array<number>;
    ascHeight?: number;
    xHeight?: number;
    words: Array<OcrWord>;
    page: OcrPage;
    _sizeCalc?: number;
    _size?: number;
    raw?: string;
    _angleAdj?: { x: number; y: number };
    par: OcrPar;
    orientation: number;
  }

  export interface OcrPar {
    page: OcrPage;
    bbox: BBox;
    lines: Array<OcrLine>;
  }

  export interface OcrPage {
    n: number;
    dims: { height: number; width: number };
    angle: number;
    pars: Array<OcrPar>;
    lines: Array<OcrLine>;
  }

  const _ScribeInstance: ScribeInstance;
  export default _ScribeInstance;
}
