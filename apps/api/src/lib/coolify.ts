/**
 * Minimal Coolify v4 API client for the platform deployments page.
 *
 * Every response is reduced to a whitelist of fields before it leaves this module: the raw
 * Coolify payload (environment variables, private keys, server details) is never returned.
 * Configuration is read at call time so tests can toggle it.
 */
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const TIMEOUT_MS = 10_000;

export interface CoolifyConfig {
  baseUrl: string;
  token: string;
  appUuid: string;
}

export function coolifyConfig(): CoolifyConfig | null {
  if (!env.COOLIFY_API_URL || !env.COOLIFY_API_TOKEN || !env.COOLIFY_APP_UUID) return null;
  return { baseUrl: env.COOLIFY_API_URL.replace(/\/+$/, ''), token: env.COOLIFY_API_TOKEN, appUuid: env.COOLIFY_APP_UUID };
}

export const COOLIFY_SETUP_INSTRUCTIONS = [
  'In Coolify, open Keys & Tokens → API tokens and create a new token with "read" and "deploy" permissions only.',
  'Copy the application UUID from the ClassIQ application page URL (…/application/<uuid>).',
  'Set COOLIFY_API_URL (e.g. http://<server>:8000/api/v1), COOLIFY_API_TOKEN and COOLIFY_APP_UUID as secrets on the API service.',
  'Redeploy the API so it picks up the new variables, then reload this page.',
];

class CoolifyHttpError extends Error {
  constructor(readonly status: number) {
    super(`Coolify request failed (HTTP ${status})`);
  }
}

async function call<T>(cfg: CoolifyConfig, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
    throw new AppError('UPSTREAM_FAILED', timedOut ? 'Coolify did not answer within 10 seconds' : 'Cannot reach Coolify');
  }
  if (!res.ok) throw new CoolifyHttpError(res.status);
  return (await res.json().catch(() => null)) as T;
}

const upstream = (err: unknown): never => {
  if (err instanceof CoolifyHttpError) throw new AppError('UPSTREAM_FAILED', err.message);
  throw err;
};

/* ------------------------------ Types ---------------------------------- */

type Raw = Record<string, unknown>;

export interface CoolifyApplication {
  name: string | null;
  status: string | null;
  fqdn: string | null;
  gitBranch: string | null;
  gitCommitSha: string | null;
  lastOnlineAt: string | null;
}

export interface CoolifyDeployment {
  id: string;
  status: string;
  commit: string | null;
  commitMessage: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  durationSec: number | null;
}

export interface CoolifyDeploymentLog {
  id: string;
  status: string;
  lines: { at: string | null; text: string }[];
}

/* ----------------------------- Helpers --------------------------------- */

const s = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);

function isoOrNull(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const FINAL = new Set(['finished', 'failed', 'cancelled-by-user', 'cancelled']);

export function normaliseDeployment(raw: Raw): CoolifyDeployment {
  const status = s(raw.status) ?? 'unknown';
  const createdAt = isoOrNull(raw.created_at);
  const finishedAt = isoOrNull(raw.finished_at) ?? (FINAL.has(status) ? isoOrNull(raw.updated_at) : null);
  const commit = s(raw.commit);
  const durationSec =
    createdAt && finishedAt ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(createdAt)) / 1000)) : null;
  return {
    id: s(raw.deployment_uuid) ?? s(raw.uuid) ?? String(raw.id ?? ''),
    status,
    commit: commit && commit !== 'HEAD' ? commit.slice(0, 7) : null,
    commitMessage: s(raw.commit_message)?.split('\n')[0]?.slice(0, 160) ?? null,
    createdAt,
    finishedAt,
    durationSec,
  };
}

/** Lines that might reveal a secret are masked entirely. */
const SECRET_LINE = /password|secret|token|key=|private key|-----begin|authorization|bearer\s/i;

export function sanitiseLogLine(text: string): string {
  return SECRET_LINE.test(text) ? '[hidden: this line may contain a secret]' : text.slice(0, 2000);
}

function parseLogs(raw: unknown): { output?: unknown; timestamp?: unknown; hidden?: unknown }[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return value ? (value as string).split('\n').map((output) => ({ output })) : [];
    }
  }
  return Array.isArray(value) ? (value as Raw[]) : [];
}

/* ------------------------------ Calls ---------------------------------- */

export async function getApplication(cfg: CoolifyConfig): Promise<CoolifyApplication> {
  const raw = await call<Raw>(cfg, 'GET', `/applications/${encodeURIComponent(cfg.appUuid)}`).catch(upstream);
  return {
    name: s(raw?.name),
    status: s(raw?.status),
    fqdn: s(raw?.fqdn),
    gitBranch: s(raw?.git_branch),
    gitCommitSha: s(raw?.git_commit_sha),
    lastOnlineAt: isoOrNull(raw?.last_online_at),
  };
}

export async function listDeployments(cfg: CoolifyConfig, take = 20): Promise<CoolifyDeployment[]> {
  let rows: Raw[];
  try {
    const raw = await call<unknown>(cfg, 'GET', `/deployments/applications/${encodeURIComponent(cfg.appUuid)}?skip=0&take=${take}`);
    rows = Array.isArray(raw) ? (raw as Raw[]) : Array.isArray((raw as Raw)?.deployments) ? ((raw as Raw).deployments as Raw[]) : [];
  } catch (err) {
    if (!(err instanceof CoolifyHttpError) || err.status !== 404) return upstream(err);
    // Older Coolify: only the running-deployments list exists. Keep this application's rows.
    const all = await call<unknown>(cfg, 'GET', '/deployments').catch(upstream);
    rows = (Array.isArray(all) ? (all as Raw[]) : []).filter(
      (r) => r.application_uuid === cfg.appUuid || (typeof r.deployment_url === 'string' && r.deployment_url.includes(cfg.appUuid)),
    );
  }
  return rows
    .map(normaliseDeployment)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, take);
}

export async function getDeploymentLogs(cfg: CoolifyConfig, id: string, maxLines = 300): Promise<CoolifyDeploymentLog> {
  const raw = await call<Raw>(cfg, 'GET', `/deployments/${encodeURIComponent(id)}`).catch(upstream);
  const lines = parseLogs(raw?.logs)
    .filter((l) => !l.hidden)
    .map((l) => ({ at: isoOrNull(l.timestamp), text: sanitiseLogLine(typeof l.output === 'string' ? l.output : '') }))
    .filter((l) => l.text.length > 0)
    .slice(-maxLines);
  return { id, status: s(raw?.status) ?? 'unknown', lines };
}

/** Queue a deployment of the latest commit. Returns the new deployment id when Coolify reports it. */
export async function deploy(cfg: CoolifyConfig): Promise<string | null> {
  const uuid = encodeURIComponent(cfg.appUuid);
  const raw = await call<Raw>(cfg, 'POST', `/deploy?uuid=${uuid}&force=false`, { uuid: cfg.appUuid }).catch(upstream);
  const first = Array.isArray(raw?.deployments) ? (raw.deployments as Raw[])[0] : undefined;
  return s(first?.deployment_uuid);
}

export async function restart(cfg: CoolifyConfig): Promise<string | null> {
  const raw = await call<Raw>(cfg, 'POST', `/applications/${encodeURIComponent(cfg.appUuid)}/restart`).catch(upstream);
  return s(raw?.deployment_uuid);
}
