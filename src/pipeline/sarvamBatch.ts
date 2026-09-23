/**
 * Sarvam AI Batch STT Client for full-length lecture recordings.
 */

const BASE_URL = 'https://api.sarvam.ai';

export interface BatchTranscription {
  transcript: string;
  languageCode: string | null;
  raw: unknown;
}

export interface BatchOptions {
  model?: string;
  languageCode?: string;
  onStage?: (stage: 'initiating' | 'uploading' | 'starting' | 'processing' | 'downloading') => void;
}

function extractTranscript(raw: unknown): { transcript: string; languageCode: string | null } {
  const obj = (raw ?? {}) as Record<string, unknown>;

  if (typeof obj.transcript === 'string') {
    return {
      transcript: obj.transcript,
      languageCode: typeof obj.language_code === 'string' ? obj.language_code : null
    };
  }
  if (Array.isArray(obj.transcripts) && obj.transcripts.length > 0) {
    const first = obj.transcripts[0] as Record<string, unknown>;
    return {
      transcript: typeof first.transcript === 'string' ? first.transcript : '',
      languageCode: typeof first.language_code === 'string' ? first.language_code : null
    };
  }
  if (obj.transcription && typeof obj.transcription === 'object') {
    const inner = obj.transcription as Record<string, unknown>;
    if (typeof inner.transcript === 'string') {
      return {
        transcript: inner.transcript,
        languageCode: typeof inner.language_code === 'string' ? inner.language_code : null
      };
    }
  }
  return { transcript: '', languageCode: null };
}

export async function sarvamBatchTranscribe(
  apiKey: string,
  file: { buffer: Buffer; filename: string; mimeType: string },
  opts: BatchOptions = {}
): Promise<BatchTranscription> {
  const model = opts.model || 'saaras:v3';
  const langMap: Record<string, string> = {
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
    od: 'od-IN',
    en: 'en-IN'
  };
  const resolved = opts.languageCode ? (langMap[opts.languageCode] || opts.languageCode) : 'unknown';
  const languageCode = resolved;

  const headers = {
    'api-subscription-key': apiKey,
    'Content-Type': 'application/json'
  };

  // 1. Initiate job
  opts.onStage?.('initiating');
  const initRes = await fetch(`${BASE_URL}/speech-to-text/job/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_parameters: {
        language_code: languageCode,
        model,
        mode: 'transcribe',
        with_timestamps: false
      }
    }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Sarvam batch initiate failed (${initRes.status}): ${errText}`);
  }
  const initData = (await initRes.json()) as { job_id: string };
  const jobId = initData.job_id;

  // 2. Get presigned upload URL
  opts.onStage?.('uploading');
  const uploadUrlRes = await fetch(`${BASE_URL}/speech-to-text/job/v1/upload-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      files: [file.filename]
    }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!uploadUrlRes.ok) {
    const errText = await uploadUrlRes.text().catch(() => '');
    throw new Error(`Sarvam batch upload-url failed (${uploadUrlRes.status}): ${errText}`);
  }
  const uploadData = (await uploadUrlRes.json()) as {
    upload_urls: Record<string, { file_url: string }>;
  };
  const uploadEntry = uploadData.upload_urls[file.filename] || Object.values(uploadData.upload_urls)[0];
  if (!uploadEntry?.file_url) {
    throw new Error('Sarvam batch: no upload URL returned for file');
  }

  // 3. PUT file to presigned URL
  const putRes = await fetch(uploadEntry.file_url, {
    method: 'PUT',
    body: new Uint8Array(file.buffer),
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'x-ms-blob-type': 'BlockBlob'
    },
    signal: AbortSignal.timeout(300_000)
  });

  if (!putRes.ok) {
    throw new Error(`Sarvam batch upload failed with status ${putRes.status}`);
  }

  // 4. Start job
  opts.onStage?.('starting');
  const startRes = await fetch(`${BASE_URL}/speech-to-text/job/v1/${jobId}/start`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(60_000)
  });

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`Sarvam batch start failed (${startRes.status}): ${errText}`);
  }

interface SarvamJobStatus {
  job_state: string;
  job_details?: Array<{ outputs?: Array<{ file_name?: string; state?: string; error_message?: string }> }>;
  error_message?: string;
}

  // 5. Poll status
  opts.onStage?.('processing');
  const terminal = new Set(['Completed', 'PartiallyCompleted', 'Failed']);
  let statusJson: SarvamJobStatus | null = null;

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusRes = await fetch(`${BASE_URL}/speech-to-text/job/v1/${jobId}/status`, {
      method: 'GET',
      headers: { 'api-subscription-key': apiKey },
      signal: AbortSignal.timeout(30_000)
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text().catch(() => '');
      throw new Error(`Sarvam batch status check failed (${statusRes.status}): ${errText}`);
    }

    const currentStatus = (await statusRes.json()) as SarvamJobStatus;
    statusJson = currentStatus;
    if (terminal.has(currentStatus.job_state)) break;
  }

  if (!statusJson) {
    throw new Error('Sarvam batch status polling timed out');
  }
  const finalStatus: SarvamJobStatus = statusJson;
  if (finalStatus.job_state === 'Failed') {
    throw new Error(`Sarvam batch job failed: ${finalStatus.error_message || 'unknown error'}`);
  }

  const outputs = finalStatus.job_details?.[0]?.outputs || [];
  const outputName =
    outputs.find((o: { file_name?: string }) => o.file_name?.endsWith('.json'))?.file_name || outputs[0]?.file_name;
  if (!outputName) {
    throw new Error('Sarvam batch job completed but produced no output file');
  }

  // 6. Get presigned download URL
  opts.onStage?.('downloading');
  const dlRes = await fetch(`${BASE_URL}/speech-to-text/job/v1/download-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job_id: jobId, files: [outputName] }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!dlRes.ok) {
    const errText = await dlRes.text().catch(() => '');
    throw new Error(`Sarvam batch download-url failed (${dlRes.status}): ${errText}`);
  }
  const dlData = (await dlRes.json()) as {
    download_urls: Record<string, { file_url: string }>;
  };
  const dlEntry = dlData.download_urls[outputName] || Object.values(dlData.download_urls)[0];
  if (!dlEntry?.file_url) throw new Error('Sarvam batch: no download URL returned');

  // 7. Download result
  const fileRes = await fetch(dlEntry.file_url, { signal: AbortSignal.timeout(60_000) });
  if (!fileRes.ok) throw new Error(`Sarvam batch download failed (${fileRes.status})`);
  const raw = (await fileRes.json()) as unknown;

  const { transcript, languageCode: lang } = extractTranscript(raw);
  return { transcript, languageCode: lang, raw };
}
