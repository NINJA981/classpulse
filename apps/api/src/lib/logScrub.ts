/**
 * Keeps database values out of logs (stdout and the app_logs table).
 *
 * - Drizzle wraps failed queries in DrizzleQueryError, whose message and stack end with
 *   `\nparams: <every bound value>` (names, emails, submission text, bcrypt hashes) and which carries
 *   a `params` array. Both are removed; the parameterised SQL text ($1, $2 …) is kept.
 * - Postgres errors (the `cause`) keep their diagnostic fields (code, constraint, table, column…), but
 *   `detail` values are redacted: `Key (email)=(a@b.c) already exists.` → `Key (email)=([redacted]) already exists.`,
 *   `Failing row contains (…)` → `Failing row contains ([redacted])`. Data-exception messages
 *   (SQLSTATE class 22, e.g. `invalid input syntax for type uuid: "…"`) lose the quoted input.
 *
 * Pure and dependency-free: both lib/logger.ts and lib/logSink.ts use it (the sink must not import the logger).
 */

export const REDACTED = '[redacted]';

const PARAMS_IN_TEXT = /\nparams: [\s\S]*?(?=\n\s+at |$)/;
const FAILED_QUERY = 'Failed query:';
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** Fields of a node-postgres DatabaseError worth keeping (none of them holds row values). */
const PG_FIELDS = ['code', 'severity', 'constraint', 'table', 'column', 'schema', 'dataType', 'routine'] as const;
const MAX_DEPTH = 6;

/** Remove the `params:` line Drizzle appends to messages and stacks. */
export function scrubText(text: string): string {
  return text.includes('\nparams: ') ? text.replace(PARAMS_IN_TEXT, '\nparams: [redacted]') : text;
}

/** Redact the values in a Postgres `detail` message, keeping column names and the kind of problem. */
export function redactPgDetail(detail: string): string {
  const key = /^(Key \((?:[^()]|\([^()]*\))*\)=\()[\s\S]*(\) (?:already exists|is not present in table|is still referenced from table|conflicts with existing key)[\s\S]*)$/.exec(
    detail,
  );
  if (key) return `${key[1]}${REDACTED}${key[2]}`;
  if (/Failing row contains \(/.test(detail)) return detail.replace(/(Failing row contains \()[\s\S]*\)/, `$1${REDACTED})`);
  // Unknown shape: anything in parentheses or quotes may be a value.
  return detail.replace(/\((?:[^()]|\([^()]*\))*\)/g, `(${REDACTED})`).replace(/"[^"]*"/g, `"${REDACTED}"`);
}

/** Data-exception messages (class 22) quote the offending input; keep the message, drop the input. */
function redactPgMessage(message: string, code: unknown): string {
  if (typeof code === 'string' && code.startsWith('22')) return message.replace(/: "[\s\S]*"$/, `: "${REDACTED}"`);
  return message;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;

function looksLikePgError(o: Obj): boolean {
  return typeof o.code === 'string' && SQLSTATE.test(o.code) && ('severity' in o || 'detail' in o || 'constraint' in o || 'routine' in o);
}

function looksLikeQueryError(o: Obj): boolean {
  return (
    (typeof o.message === 'string' && o.message.startsWith(FAILED_QUERY)) ||
    o.name === 'DrizzleQueryError' ||
    o.type === 'DrizzleQueryError' ||
    (isObj(o.constructor) && (o.constructor as { name?: unknown }).name === 'DrizzleQueryError')
  );
}

/** Whether an error (or its cause chain) needs scrubbing at all. */
function needsScrub(v: unknown, depth = 0): boolean {
  if (!isObj(v) || depth > MAX_DEPTH) return false;
  if (looksLikeQueryError(v) || looksLikePgError(v)) return true;
  if (typeof v.message === 'string' && v.message.includes('\nparams: ')) return true;
  return needsScrub(v.cause, depth + 1);
}

function scrubPg(o: Obj, out: Obj): void {
  for (const f of PG_FIELDS) if (o[f] !== undefined) out[f] = o[f];
  if (typeof o.detail === 'string') out.detail = redactPgDetail(o.detail);
  if (typeof o.message === 'string') out.message = redactPgMessage(o.message, o.code);
  if (typeof o.stack === 'string' && typeof o.message === 'string') out.stack = o.stack.replace(o.message, String(out.message));
}

/**
 * Return a copy of an error that is safe to log. Error instances keep their prototype (so pino's error
 * serializer still reports the right `type`); anything that needs no scrubbing is returned unchanged.
 */
export function scrubError<T>(err: T, depth = 0): T {
  if (typeof err === 'string') return scrubText(err) as T;
  if (!isObj(err) || depth > MAX_DEPTH || !needsScrub(err)) return err;
  const src = err as Obj;
  const out: Obj = Object.create(Object.getPrototypeOf(src) as object | null) as Obj;
  if (looksLikePgError(src)) {
    // A Postgres error: only the known diagnostic fields survive.
    scrubPg(src, out);
    if (src.name !== undefined) Object.defineProperty(out, 'name', { value: src.name, enumerable: false, writable: true });
  } else {
    for (const key of Object.keys(src)) {
      if (key === 'params' || key === 'cause') continue;
      out[key] = typeof src[key] === 'string' ? scrubText(src[key] as string) : src[key];
    }
    // message and stack are usually own but non-enumerable on Error instances.
    for (const key of ['message', 'stack'] as const) {
      const v = src[key];
      if (typeof v === 'string') Object.defineProperty(out, key, { value: scrubText(v), enumerable: false, writable: true, configurable: true });
    }
    if (typeof src.name === 'string' && !Object.keys(src).includes('name')) {
      Object.defineProperty(out, 'name', { value: src.name, enumerable: false, writable: true, configurable: true });
    }
    if ('params' in src) out.params = REDACTED;
  }
  if (src.cause !== undefined) {
    Object.defineProperty(out, 'cause', { value: scrubError(src.cause, depth + 1), enumerable: false, writable: true, configurable: true });
  }
  return out as T;
}

/**
 * Scrub an already-serialized (JSON) log object in place-safe fashion (returns a copy where needed):
 * used by the app_logs sink as a second line of defence.
 */
export function scrubLogValue(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return scrubText(v);
  if (depth > MAX_DEPTH || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => scrubLogValue(x, depth + 1));
  const o = v as Obj;
  const pg = looksLikePgError(o);
  const query = looksLikeQueryError(o);
  const out: Obj = {};
  for (const [k, val] of Object.entries(o)) {
    if (k === 'params' && (query || 'query' in o)) {
      out[k] = REDACTED;
    } else if (pg && k === 'detail' && typeof val === 'string') {
      out[k] = redactPgDetail(val);
    } else if (pg && k === 'message' && typeof val === 'string') {
      out[k] = redactPgMessage(val, o.code);
    } else if (pg && (k === 'where' || k === 'internalQuery' || k === 'hint' || k === 'file' || k === 'line' || k === 'position' || k === 'internalPosition')) {
      continue;
    } else {
      out[k] = scrubLogValue(val, depth + 1);
    }
  }
  return out;
}
