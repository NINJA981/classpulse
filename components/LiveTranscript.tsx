'use client';

/**
 * Live captions while the teacher records.
 *
 * It taps the same MediaStream the recorder is already using, resamples to 16 kHz mono
 * through an AudioContext, and streams 100 ms PCM frames to our backend, which relays them
 * to Sarvam and sends partial transcripts straight back.
 *
 * Everything finalised is saved server-side, and the lesson claims it on creation, so the
 * teacher ends up with both this and the transcript made from the uploaded recording — and
 * chooses which one the questions are written from.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { liveTranscriptUrl, rememberLiveSession } from '../lib/api';

interface LiveTranscriptProps {
  /** The recorder's stream. Null when not recording. */
  stream: MediaStream | null;
  active: boolean;
  /** BCP-47 code Sarvam accepts, or 'auto' for a code-mixed classroom. */
  language?: string;
  /**
   * When the lesson already exists, the captions save straight onto it. Without this they
   * are parked as a session and claimed by the next createLesson.
   */
  lessonId?: string;
  /** Every finalised line, so the parent can keep the text after recording stops. */
  onFinalLine?: (line: string) => void;
}

type Status = 'idle' | 'connecting' | 'listening' | 'error' | 'signed-out';

export default function LiveTranscript({
  stream,
  active,
  language = 'auto',
  lessonId,
  onFinalLine,
}: LiveTranscriptProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [partial, setPartial] = useState('');

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const onFinalRef = useRef(onFinalLine);
  onFinalRef.current = onFinalLine;

  const teardown = useCallback(() => {
    nodeRef.current?.port.close();
    nodeRef.current?.disconnect();
    nodeRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: 'end' }));
      socket.close();
    }
    socketRef.current = null;
  }, []);

  useEffect(() => {
    if (!active || !stream) {
      teardown();
      setPartial('');
      setStatus('idle');
      return;
    }

    const url = liveTranscriptUrl({ language, lessonId });
    if (!url) {
      setStatus('signed-out');
      setMessage('Sign in to the live backend to use live captions.');
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    setMessage('');

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      let payload: {
        event?: string;
        text?: string;
        message?: string;
        code?: number;
        liveSessionId?: string;
      };
      try {
        payload = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (payload.event === 'relay.ready') {
        setStatus('listening');
      } else if (payload.event === 'relay.saved') {
        // The captions were written away server-side. Park the id so createLesson can claim
        // it — this recording happens before the lesson exists.
        if (payload.liveSessionId) rememberLiveSession(payload.liveSessionId);
      } else if (payload.event === 'transcript.partial' && payload.text) {
        setPartial(payload.text);
      } else if (payload.event === 'transcript.final' && payload.text) {
        const line = payload.text.trim();
        setPartial('');
        setLines((current) => [...current, line]);
        onFinalRef.current?.(line);
      } else if (payload.event === 'error') {
        setStatus('error');
        setMessage(payload.message || 'Live captions stopped.');
      }
    };

    socket.onerror = () => {
      if (cancelled) return;
      setStatus('error');
      setMessage('Could not reach the live transcription service.');
    };

    socket.onclose = (event) => {
      if (cancelled) return;
      // 1000 is a clean stop; anything else while recording is worth telling the teacher.
      if (event.code !== 1000 && active) {
        setStatus('error');
        setMessage(
          event.code === 4401
            ? 'Your session expired. Sign in again for live captions.'
            : 'Live captions disconnected. The recording itself is unaffected.',
        );
      }
    };

    // --- microphone -> 16 kHz PCM -> socket ------------------------------------------------
    const start = async () => {
      try {
        // Asking for 16 kHz lets the browser do the resampling for us.
        const context = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = context;
        await context.audioWorklet.addModule('/pcm-worklet.js');
        if (cancelled) return;

        const source = context.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(context, 'pcm-worklet');
        nodeRef.current = node;

        node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const bytes = new Uint8Array(event.data);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          socket.send(JSON.stringify({ event: 'audio_input', audio: btoa(binary) }));
        };

        source.connect(node);
        // Keep the graph pulling without sending the teacher's own voice to the speakers.
        const silence = context.createGain();
        silence.gain.value = 0;
        node.connect(silence).connect(context.destination);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Microphone access was refused.'
            : 'This browser cannot run live captions.',
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [active, stream, language, lessonId, teardown]);

  if (status === 'idle' && lines.length === 0) return null;

  const label: Record<Status, string> = {
    idle: 'Live captions',
    connecting: 'Connecting…',
    listening: 'Listening',
    error: 'Captions unavailable',
    'signed-out': 'Captions unavailable',
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: '1px solid var(--line, #d3dbd7)',
        borderRadius: 10,
        background: 'var(--surface-2, #f5f8f6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: status === 'error' || status === 'signed-out' ? '#c93c1c' : '#6b7772',
          marginBottom: 10,
        }}
      >
        {status === 'listening' && (
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#c93c1c',
              display: 'inline-block',
            }}
          />
        )}
        {label[status]}
      </div>

      {message && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#c93c1c' }}>{message}</p>
      )}

      <div
        aria-live="polite"
        style={{ maxHeight: 180, overflowY: 'auto', fontSize: 14, lineHeight: 1.6 }}
      >
        {lines.length === 0 && !partial && status === 'listening' && (
          <span style={{ color: '#6b7772' }}>Start speaking and the words will appear here.</span>
        )}
        {lines.map((line, index) => (
          <p key={index} style={{ margin: '0 0 6px' }}>
            {line}
          </p>
        ))}
        {partial && <p style={{ margin: 0, color: '#6b7772' }}>{partial}</p>}
      </div>
    </div>
  );
}
