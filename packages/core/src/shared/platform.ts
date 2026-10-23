// Everything the core needs from the platform, passed in by the app (Node CLI/MCP, Electron main).
// The core never reaches for globals: no fetch, clock, timers, console, fs or process of its own
// (packages/core/tests/purity.test.ts).

export type Clock = {
  nowMs(): number;
  /** Resolves after `ms`; with a signal it may settle early when the signal aborts (the core re-checks the signal either way). */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};

/** The subset of a fetch Response the core reads. */
export type ResponseLike = {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
};

/** The subset of fetch the core calls: GET with headers and an abort signal. */
export type FetchLike = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<ResponseLike>;

export type Logger = {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
};

export type Platform = {
  fetch: FetchLike;
  clock: Clock;
  logger: Logger;
  /** Unique id generator (e.g. crypto.randomUUID); for import jobs from stage 1 on. */
  randomId(): string;
};
