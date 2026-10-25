// utilityProcess entry: decodes one statement file. Forked per upload by main (src/main/decoder-client.ts) with an
// empty environment: one `decode` in, one checked reply out (FromDecoder.parse: nothing past the limits, nothing
// untyped leaves). Main kills it on the reply — it does not exit by itself, so the reply is never lost to its own exit.
// It holds no key, no token, no database and no network module, and has no channel to the renderer.
import { DecodeMessage, FromDecoder, type DecodeMessage as Decode } from '../shared/decoder-protocol.ts';
import { decodePdf } from './pdf.ts';
import { decodeXlsx } from './xlsx.ts';

const port = process.parentPort;
let taken = false;

async function decode(msg: Decode): Promise<FromDecoder> {
  const r = msg.format === 'xlsx' ? decodeXlsx(msg.bytes) : await decodePdf(msg.bytes);
  return r.ok ? { type: 'document', document: r.document } : { type: 'failure', code: r.code };
}

port.on('message', (event: { data: unknown }) => {
  if (taken) return; // one file per process
  const parsed = DecodeMessage.safeParse(event.data);
  if (!parsed.success) return; // not from our main: ignore silently
  taken = true;
  void decode(parsed.data).then((msg) => port.postMessage(FromDecoder.parse(msg)));
});
