// The statement decoder from main's side: which files go to it, and one fork per file (src/decoder/process.ts) — one
// `decode`, one reply checked against FromDecoder (limits included), then the process is killed: on the reply, on its
// exit, or after DECODE_TIMEOUT_MS. Nothing the decoder sends reaches a reader unchecked.
import {
  DECODE_LIMITS,
  DecodeMessage,
  FromDecoder,
  type DecodeFailure,
  type DecodeFormat,
  type DecodedDocument,
} from '../shared/decoder-protocol.ts';

/** How long one file may take to decode. */
export const DECODE_TIMEOUT_MS = 30_000;

/** What a file is, by its leading bytes: a PDF, a zip (a workbook), or else text that main decodes itself. */
export function sniffFormat(bytes: Uint8Array): DecodeFormat | 'text' {
  const starts = (sig: readonly number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (starts([0x50, 0x4b, 0x03, 0x04])) return 'xlsx'; // PK\3\4
  return 'text';
}

export type DecoderChild = {
  postMessage(msg: DecodeMessage): void;
  kill(): boolean;
  on(event: 'message', listener: (msg: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
};

/** The decoder's own codes, plus main's: no reply in time, an exit without a reply, a reply that breaks the schema. */
export type DecodeError = DecodeFailure | 'timeout' | 'crashed' | 'bad-reply';
export type DecodeOutcome = { ok: true; document: DecodedDocument } | { ok: false; code: DecodeError };

export type DecoderClientDeps = {
  fork: () => DecoderChild;
  /** Main log: codes only. */
  log: (msg: string) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (t: unknown) => void;
};

export class DecoderClient {
  private readonly running = new Set<DecoderChild>();

  constructor(private readonly d: DecoderClientDeps) {}

  async decode(format: DecodeFormat, bytes: Uint8Array): Promise<DecodeOutcome> {
    const msg = DecodeMessage.safeParse({ type: 'decode', format, bytes });
    if (!msg.success) return { ok: false, code: bytes.byteLength > DECODE_LIMITS.bytes ? 'too-large' : 'unreadable' };
    const child = this.d.fork();
    this.running.add(child);
    return new Promise<DecodeOutcome>((resolve) => {
      let done = false;
      const finish = (outcome: DecodeOutcome) => {
        if (done) return;
        done = true;
        (this.d.clearTimeout ?? clearTimeout)(timer as ReturnType<typeof setTimeout>);
        this.running.delete(child);
        child.kill();
        if (!outcome.ok) this.d.log(`decode: ${outcome.code}`);
        resolve(outcome);
      };
      const timer = (this.d.setTimeout ?? setTimeout)(() => finish({ ok: false, code: 'timeout' }), DECODE_TIMEOUT_MS);
      child.on('message', (raw) => {
        const reply = FromDecoder.safeParse(raw);
        if (!reply.success) finish({ ok: false, code: 'bad-reply' });
        else if (reply.data.type === 'document') finish({ ok: true, document: reply.data.document });
        else finish({ ok: false, code: reply.data.code });
      });
      child.on('exit', () => finish({ ok: false, code: 'crashed' }));
      try {
        child.postMessage(msg.data);
      } catch {
        finish({ ok: false, code: 'crashed' });
      }
    });
  }

  /** On quit: a decode in flight is killed (its caller gets `crashed`). */
  kill(): void {
    for (const child of this.running) child.kill();
  }
}
