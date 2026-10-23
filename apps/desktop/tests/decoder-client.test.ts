// Main's side of the statement decoder (src/main/decoder-client.ts) with a fake child: one fork per file, the reply
// checked, the child killed on the reply, on its exit and after the timeout; and which files go to it at all.
import { describe, expect, it } from 'vitest';
import { DECODE_TIMEOUT_MS, DecoderClient, sniffFormat, type DecoderChild } from '../src/main/decoder-client.ts';
import { DECODE_LIMITS, type DecodeMessage } from '../src/shared/decoder-protocol.ts';

const DOC = { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 's', v: 'Вигадана' }]] }] } as const;

function fakeChild() {
  const listeners: { message: Array<(m: unknown) => void>; exit: Array<(c: number) => void> } = { message: [], exit: [] };
  const sent: DecodeMessage[] = [];
  let killed = 0;
  const child: DecoderChild = {
    postMessage: (m) => void sent.push(m),
    kill: () => {
      killed++;
      // A killed process exits.
      for (const l of listeners.exit) l(1);
      return true;
    },
    on: (event: 'message' | 'exit', l: (x: never) => void) => void listeners[event].push(l as never),
  };
  return {
    child,
    sent,
    killed: () => killed,
    reply: (m: unknown) => listeners.message.forEach((l) => l(m)),
    exit: () => listeners.exit.forEach((l) => l(0)),
  };
}

function harness() {
  const children: Array<ReturnType<typeof fakeChild>> = [];
  const logs: string[] = [];
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const client = new DecoderClient({
    fork: () => {
      const c = fakeChild();
      children.push(c);
      return c.child;
    },
    log: (m) => logs.push(m),
    setTimeout: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimeout: (t) => void ((t as { cleared: boolean }).cleared = true),
  });
  return { client, children, logs, timers };
}

const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

describe('DecoderClient', () => {
  it('one fork per file: sends one decode, takes the checked document, kills the child', async () => {
    const { client, children, timers } = harness();
    const p = client.decode('xlsx', bytes);
    const [c] = children;
    expect(c?.sent).toEqual([{ type: 'decode', format: 'xlsx', bytes }]);
    c?.reply({ type: 'document', document: DOC });
    expect(await p).toEqual({ ok: true, document: DOC });
    expect(c?.killed()).toBe(1);
    expect(timers[0]).toMatchObject({ ms: DECODE_TIMEOUT_MS, cleared: true });

    const q = client.decode('pdf', bytes);
    expect(children).toHaveLength(2);
    children[1]?.reply({ type: 'failure', code: 'encrypted' });
    expect(await q).toEqual({ ok: false, code: 'encrypted' });
  });

  it('a reply that breaks the schema is refused, never passed on', async () => {
    const { client, children, logs } = harness();
    const p = client.decode('xlsx', bytes);
    children[0]?.reply({ type: 'document', document: { ...DOC, sheets: [{ name: 'S', rows: [[{ t: 'f', v: '=1' }]] }] } });
    expect(await p).toEqual({ ok: false, code: 'bad-reply' });
    expect(logs).toEqual(['decode: bad-reply']);
    expect(children[0]?.killed()).toBe(1);
  });

  it('no reply in time: killed, timeout', async () => {
    const { client, children, timers } = harness();
    const p = client.decode('pdf', bytes);
    timers[0]?.fn();
    expect(await p).toEqual({ ok: false, code: 'timeout' });
    expect(children[0]?.killed()).toBe(1);
  });

  it('an exit without a reply: crashed; a late reply changes nothing', async () => {
    const { client, children } = harness();
    const p = client.decode('pdf', bytes);
    children[0]?.exit();
    children[0]?.reply({ type: 'document', document: DOC });
    expect(await p).toEqual({ ok: false, code: 'crashed' });
  });

  it('kill() on quit ends a decode in flight', async () => {
    const { client } = harness();
    const p = client.decode('pdf', bytes);
    client.kill();
    expect(await p).toEqual({ ok: false, code: 'crashed' });
  });

  it('a file past the limit is not sent at all', async () => {
    const { client, children } = harness();
    expect(await client.decode('pdf', new Uint8Array(DECODE_LIMITS.bytes + 1))).toEqual({ ok: false, code: 'too-large' });
    expect(children).toHaveLength(0);
  });
});

describe('sniffFormat', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it.each([
    ['%PDF-1.7\n…', 'pdf'],
    ['PK\x03\x04rest', 'xlsx'],
    ['"Дата i час операції",MCC\n', 'text'],
    ['%PDF', 'text'],
    ['PK\x05\x06', 'text'],
    [' %PDF-1.7', 'text'],
    ['', 'text'],
  ])('%j → %s', (head, format) => {
    expect(sniffFormat(enc(head))).toBe(format);
  });
});
