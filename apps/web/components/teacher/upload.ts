import type { ApiErrorBody } from '@classpulse/shared';
import { ApiError, isSafeApiPath } from '@/lib/api';

export interface UploadHandle<T> {
  promise: Promise<T>;
  abort: () => void;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Multipart upload with progress reporting. `fetch` cannot report upload
 * progress, so this uses XMLHttpRequest with the same-origin session cookie and
 * maps failures to the same `ApiError` that `lib/api` throws.
 */
export function uploadFile<T>(
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
  field = 'file',
): UploadHandle<T> {
  const xhr = new XMLHttpRequest();
  const url = path.startsWith('/api') ? path : `/api${path}`;

  const promise = new Promise<T>((resolve, reject) => {
    if (!isSafeApiPath(path)) {
      reject(new ApiError(0, 'BAD_REQUEST', 'This link is not valid.'));
      return;
    }
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.timeout = 30 * 60_000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const body = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      const err = (body as ApiErrorBody | null)?.error;
      const fallback =
        xhr.status === 413 ? 'This file is too large to upload.' : `Upload failed (${xhr.status || 'network error'})`;
      reject(
        new ApiError(
          xhr.status,
          err?.code ?? (xhr.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL'),
          err?.message ?? fallback,
          err?.details,
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError(0, 'INTERNAL', 'Cannot reach the server. Check your connection.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'INTERNAL', 'The upload timed out. Check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'INTERNAL', 'Upload cancelled.'));

    const form = new FormData();
    form.append(field, file);
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
