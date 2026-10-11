import { SUBMISSION_FILE_MAX_MB, SUBMISSION_FILE_TYPES, type ApiErrorBody, type StudentAssignment } from '@classpulse/shared';
import { ApiError } from '@/lib/api';

/** `accept` attribute for the file picker (MIME types and extensions). */
export const SUBMISSION_ACCEPT = Object.entries(SUBMISSION_FILE_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(',');

const ALLOWED_EXTENSIONS = new Set<string>(Object.values(SUBMISSION_FILE_TYPES).flat());

/** Why a picked file cannot be uploaded, or null when it is fine. */
export function fileProblem(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return `${file.name}: use PDF, JPEG, PNG, HEIC or Word (.docx) files.`;
  if (file.size > SUBMISSION_FILE_MAX_MB * 1024 * 1024) return `${file.name} is larger than ${SUBMISSION_FILE_MAX_MB} MB.`;
  return null;
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
 * Multipart submission (text + files) with upload progress. `fetch` cannot report upload progress, so this
 * uses XMLHttpRequest with the same-origin session cookie and maps failures to the `ApiError` of lib/api.
 */
export function uploadSubmission(
  assignmentId: string,
  text: string,
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<StudentAssignment> {
  return new Promise<StudentAssignment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/student/assignments/${assignmentId}/submission`);
    xhr.withCredentials = true;
    xhr.timeout = 10 * 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const body = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as StudentAssignment);
        return;
      }
      const err = (body as ApiErrorBody | null)?.error;
      const fallback = xhr.status === 413 ? `Each file must be ${SUBMISSION_FILE_MAX_MB} MB or smaller.` : `Upload failed (${xhr.status || 'network error'})`;
      reject(new ApiError(xhr.status, err?.code ?? (xhr.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL'), err?.message ?? fallback, err?.details));
    };
    xhr.onerror = () => reject(new ApiError(0, 'INTERNAL', 'Cannot reach the server. Check your connection.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'INTERNAL', 'The upload timed out. Check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'INTERNAL', 'Upload cancelled.'));

    const form = new FormData();
    form.append('text', text);
    for (const f of files) form.append('files', f, f.name);
    xhr.send(form);
  });
}
