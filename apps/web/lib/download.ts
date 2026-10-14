/**
 * Download a file the API sends as an attachment (data exports) and save it in the browser.
 * Same-origin `/api` with the session cookie, like `api`; failures throw the API's `ApiError`.
 */
import type { ApiErrorBody } from '@classiq/shared';
import { ApiError } from './api';

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      /* fall through to the ASCII name */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

export async function downloadFromApi(
  method: 'GET' | 'POST',
  path: string,
  { body, fallbackName = 'download', timeoutMs = 10 * 60_000 }: { body?: unknown; fallbackName?: string; timeoutMs?: number } = {},
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
      method,
      credentials: 'include',
      // POSTs always carry a JSON body (the API refuses body-less or non-JSON unsafe requests).
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = ((await res.json().catch(() => null)) as ApiErrorBody | null)?.error;
      throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Download failed (${res.status})`, err?.details);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFrom(res.headers.get('Content-Disposition'), fallbackName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') throw new ApiError(0, 'INTERNAL', 'The download timed out. Try again.');
    throw new ApiError(0, 'INTERNAL', 'Cannot reach the server. Check your connection.');
  } finally {
    clearTimeout(timeout);
  }
}
