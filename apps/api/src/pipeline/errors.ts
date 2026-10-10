/**
 * Errors raised by the generation pipeline. `message` is for logs (it may include
 * upstream status codes, never response bodies or secrets); `userMessage` is the
 * sanitized text stored on the lesson and shown to the teacher.
 */
export class PipelineError extends Error {
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(message: string, opts: { retryable: boolean; userMessage?: string; cause?: unknown }) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = 'PipelineError';
    this.retryable = opts.retryable;
    this.userMessage = opts.userMessage ?? 'Processing failed. Please try again.';
  }
}

export const isPipelineError = (err: unknown): err is PipelineError => err instanceof PipelineError;

/** Generic message used whenever an error has no sanitized user message. */
export const GENERIC_FAILURE_MESSAGE = 'Processing failed. Please try again.';
