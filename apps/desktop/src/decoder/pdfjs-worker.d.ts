// pdf.js ships no types for its worker module; the decoder only hands it to pdf.js (`globalThis.pdfjsWorker`).
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
