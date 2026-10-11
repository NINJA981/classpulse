'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import type { VoicePromptResult } from '@classpulse/shared';
import { Button, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

const MAX_SEC = 60;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
}

const extFor = (mime: string) => (mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm');

/**
 * Speak a request (any Indian language, up to 60 s): records with MediaRecorder, uploads to
 * POST /api/resources/voice and hands the transcribed text to `onText`.
 */
export function VoicePromptButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(
    () => () => {
      stopTimer();
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function upload(blob: Blob, mime: string) {
    setState('uploading');
    try {
      const form = new FormData();
      form.append('audio', blob, `voice-prompt.${extFor(mime)}`);
      const result = await api.upload<VoicePromptResult>('/resources/voice', form, 90_000);
      onText(result.text);
      toast('Voice prompt added');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setState('idle');
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Voice input is not supported in this browser.', 'error');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast('Allow microphone access to speak your request.', 'error');
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      stopTimer();
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      recorder.current = null;
      if (blob.size) void upload(blob, type);
      else setState('idle');
    };
    recorder.current = rec;
    rec.start();
    setElapsed(0);
    setState('recording');
    const startedAt = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(s);
      if (s >= MAX_SEC && rec.state === 'recording') rec.stop();
    }, 250);
  }

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <Button variant="danger" size="sm" icon={<Square className="size-3.5" aria-hidden />} onClick={stop}>
          Stop recording
        </Button>
        <span role="timer" aria-live="off" className="font-display text-sm font-black tabular-nums">
          0:{String(elapsed).padStart(2, '0')} / 1:00
        </span>
        <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden />
      </div>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Mic className="size-4" aria-hidden />}
      onClick={() => void start()}
      loading={state === 'uploading'}
      disabled={disabled}
    >
      {state === 'uploading' ? 'Transcribing…' : 'Speak your request'}
    </Button>
  );
}
