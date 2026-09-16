'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface AudioReadyData {
  file: File;
  blob: Blob;
  url: string;
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
}

interface AudioRecorderProps {
  onAudioReady: (data: AudioReadyData) => void;
  onReset?: () => void;
}

/**
 * Android Chrome Compatible Audio Recorder
 * - Negotiates best mobile-supported MIME types (audio/webm;codecs=opus, audio/webm, audio/mp4, audio/ogg)
 * - Safe timeslice chunking (1000ms) to ensure zero dropped buffers on mobile
 * - Web Audio API Analyser for real-time waveform level display
 * - Handles Android Chrome autoplay / suspended AudioContext policies
 * - Full controls: Record, Pause, Resume, Stop, Playback Preview, Retake
 */
export default function AudioRecorder({ onAudioReady, onReset }: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [recordedSize, setRecordedSize] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getSupportedMimeType = (): string => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/aac'
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  };

  const setupVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#f8f8f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight: number;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
          ctx.fillStyle = '#111111';
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn('Audio visualizer init error:', e);
    }
  };

  const startRecording = async () => {
    setErrorMessage('');
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser. Please use Chrome on Android or desktop.');
      }

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setRecordedSize(audioBlob.size);

        const extension = finalMime.includes('mp4') ? 'mp4' : finalMime.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([audioBlob], `lesson_recording_${Date.now()}.${extension}`, {
          type: finalMime
        });

        if (onAudioReady) {
          onAudioReady({
            file,
            blob: audioBlob,
            url,
            durationSec: elapsedSeconds,
            mimeType: finalMime,
            sizeBytes: audioBlob.size
          });
        }
      };

      mediaRecorder.start(1000);
      setRecordingState('recording');
      setElapsedSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      setupVisualizer(stream);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in Android Chrome site settings.');
      } else {
        setErrorMessage(err.message || 'Unable to access microphone.');
      }
      setRecordingState('idle');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setRecordingState('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      setRecordingState('recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setRecordingState('stopped');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    }
  };

  const handleRetake = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setElapsedSeconds(0);
    setRecordedSize(0);
    setRecordingState('idle');
    audioChunksRef.current = [];
    if (onReset) onReset();
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="recorder-panel">
      <span className="eyebrow">IN-BROWSER AUDIO RECORDER (ANDROID CHROME READY)</span>

      {errorMessage && (
        <div className="card mb-2" style={{ border: '2px solid #111', background: '#faf9f6' }}>
          <span className="eyebrow" style={{ color: '#111' }}>HARDWARE NOTICE</span>
          <p style={{ fontSize: '13px', fontWeight: 600 }}>{errorMessage}</p>
        </div>
      )}

      {recordingState === 'idle' && (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <p className="text-secondary mb-3" style={{ fontSize: '13px' }}>
            Direct Android Chrome / Desktop capture. Speak clearly into your device microphone.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={startRecording}
          >
            Start Audio Recording
          </button>
        </div>
      )}

      {(recordingState === 'recording' || recordingState === 'paused') && (
        <div>
          <div className="flex-between">
            <div>
              <span className="eyebrow">STATUS</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {recordingState === 'recording' && <span className="recording-dot" />}
                <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '12px' }}>
                  {recordingState === 'recording' ? 'LIVE CAPTURE ACTIVE' : 'RECORDING PAUSED'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="eyebrow">ELAPSED TIME</span>
              <div className="recorder-timer">{formatTimer(elapsedSeconds)}</div>
            </div>
          </div>

          <canvas ref={canvasRef} width={500} height={60} className="waveform-canvas" />

          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
            {recordingState === 'recording' ? (
              <button type="button" className="btn btn-secondary" onClick={pauseRecording}>
                Pause
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={resumeRecording}>
                Resume
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={stopRecording}>
              Stop & Finalize Audio
            </button>
          </div>
        </div>
      )}

      {recordingState === 'stopped' && audioUrl && (
        <div>
          <div className="flex-between mb-2">
            <div>
              <span className="eyebrow">AUDIO CAPTURE READY</span>
              <h3 style={{ fontSize: '1rem' }}>Recorded Audio Master</h3>
            </div>
            <span className="status-pill status-pill-ready">
              {formatTimer(elapsedSeconds)} • {formatBytes(recordedSize)}
            </span>
          </div>

          <div className="audio-preview-box">
            <span className="eyebrow">VERIFY PLAYBACK BEFORE SUBMISSION</span>
            <audio controls src={audioUrl} style={{ width: '100%', marginTop: '6px' }} />
          </div>

          <div className="flex-between mt-3">
            <p className="text-secondary" style={{ fontSize: '12px' }}>
              Ready to be attached to draft lesson on submit.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleRetake}>
              Discard & Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
