// Main's view of the data process: one async function per method of src/shared/data-protocol.ts, over a call that
// reaches it. A failure comes back as a DataCallError: its code and the original error's name, no message.
import { DATA_METHODS, DataCallError, type DataArgs, type DataCall, type DataMethod, type DataResult } from '../shared/data-protocol.ts';

export type DataApi = { [M in DataMethod]: (...args: DataArgs<M>) => Promise<DataResult<M>> };

export function dataApi(call: DataCall): DataApi {
  const api: Partial<Record<DataMethod, (...args: unknown[]) => Promise<unknown>>> = {};
  for (const method of DATA_METHODS) {
    api[method] = async (...args) => {
      const reply = await call(method, args);
      if (reply.type === 'failure') throw new DataCallError(reply.code, reply.name);
      return reply.value;
    };
  }
  return api as DataApi;
}
