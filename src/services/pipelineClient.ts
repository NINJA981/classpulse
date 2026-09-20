import fs from "fs";

/**
 * Client for the lecture pipeline sidecar (see the pipeline repo README).
 * The EMBED_API_KEY lives here, server-side only — never sent to browsers.
 */

const PIPELINE_URL = (process.env.PIPELINE_URL || "http://localhost:4000").replace(/\/$/, "");
const PIPELINE_API_KEY = process.env.PIPELINE_API_KEY || process.env.EMBED_API_KEY || "";

export interface PipelineQuestion {
  id: string;
  type: string; // mcq | true_false | fill_in_the_blank | short_answer
  question: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  answerExplanation: string;
  difficulty: string;
  source: { startTime: number; endTime: number; chunkIds: string[] };
}

export interface PipelineIngestResult {
  sessionId: string;
  language: string | null;
  durationSec: number;
  transcript: {
    segments: Array<{ id: string; startTime: number; endTime: number; rawText: string }>;
    refinedChunks: Array<{ id: string; startTime: number; endTime: number; refinedText: string }>;
  };
  quiz: {
    id: string;
    contentUntil: number;
    questions: PipelineQuestion[];
  };
  summary: string | null;
  keyTakeaways: string[];
}

export class PipelineError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PipelineError";
    this.status = status;
  }
}

function requireKey(): string {
  if (!PIPELINE_API_KEY) {
    throw new PipelineError(
      503,
      "Pipeline not configured: set PIPELINE_API_KEY (the pipeline's EMBED_API_KEY) in SIH-backend .env"
    );
  }
  return PIPELINE_API_KEY;
}

async function pipelineFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${PIPELINE_URL}${path}`, {
    method,
    headers: {
      "x-api-key": requireKey(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120_000)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      detail = parsed.message || parsed.error || text;
    } catch {
      /* keep raw */
    }
    throw new PipelineError(res.status, `Pipeline ${method} ${path}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * Ingest a full lecture recording: pipeline transcribes it (Sarvam batch),
 * refines, extracts knowledge, generates a quiz and a summary. Long-running
 * (minutes) — callers should run it inside their job worker.
 */
export async function ingestLectureFile(params: {
  filePath: string;
  title: string;
  subject: string;
  teacherId: string;
  language?: string;
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard";
}): Promise<PipelineIngestResult> {
  const buffer = await fs.promises.readFile(params.filePath);
  const ext = params.filePath.split(".").pop()?.toLowerCase() || "webm";
  const mimeByExt: Record<string, string> = {
    webm: "audio/webm",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/x-m4a",
    aac: "audio/aac",
    ogg: "audio/ogg",
    opus: "audio/opus",
    flac: "audio/flac"
  };
  const mimeType = mimeByExt[ext] || "application/octet-stream";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `lecture.${ext}`);
  form.append("title", params.title);
  form.append("subject", params.subject);
  form.append("language", params.language || "en-IN");
  form.append("externalIds", JSON.stringify({ teacherId: params.teacherId }));
  form.append("questionCount", String(params.questionCount ?? 5));
  form.append("difficulty", params.difficulty ?? "medium");
  form.append("types", JSON.stringify(["mcq", "true_false"]));

  const res = await fetch(`${PIPELINE_URL}/v1/ingest/audio-file`, {
    method: "POST",
    headers: { "x-api-key": requireKey() },
    body: form,
    signal: AbortSignal.timeout(900_000) // batch STT of long lectures can take minutes
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      detail = parsed.error || text;
    } catch {
      /* keep raw */
    }
    throw new PipelineError(res.status, `Pipeline ingest: ${detail.slice(0, 400)}`);
  }
  return (await res.json()) as PipelineIngestResult;
}

/** Health probe used by /api/health to report pipeline connectivity. */
export async function pipelineHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${PIPELINE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = (await res.json()) as { status?: string };
    return { ok: body.status === "healthy", detail: body.status || "unknown" };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}
