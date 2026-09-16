import React, { useState, useRef, useEffect } from 'react';

/**
 * Android Chrome Compatible Audio Recorder
 * - Detects optimal mobile-supported MIME types (audio/webm;codecs=opus, audio/webm, audio/mp4, audio/ogg)
 * - Safe timeslice chunking (1000ms) to ensure no dropped buffers on Android Chrome
 * - Web Audio API Analyser for real-time waveform / audio level display
 * - Handles Android Chrome autoplay / suspended AudioContext policies
 * - Full controls: Record, Pause, Resume, Stop, Playback Preview, Retake
 */
export default function AudioRecorder({ onAudioReady, onReset }) {
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [recordedSize, setRecordedSize] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);

  // Negotiate best supported MIME type for mobile Chrome
  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return null;
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
    return ''; // Browser default
  };

  // Setup real-time waveform visualizer
  const setupVisualizer = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Mobile Chrome may suspend AudioContext until user interaction
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
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#f8f8f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

          // Swiss brutalist monochrome bars
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

      mediaRecorder.ondataavailable = (event) => {
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

        // Produce a named File for attachment
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

      // 1000ms timeslice is vital on mobile Chrome to flush buffers reliably
      mediaRecorder.start(1000);
      setRecordingState('recording');
      setElapsedSeconds(0);

      // Start elapsed timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Start waveform visualization
      setupVisualizer(stream);
    } catch (err) {
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
      clearInterval(timerIntervalRef.current);
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
      clearInterval(timerIntervalRef.current);
      setRecordingState('stopped');

      // Stop all tracks to release hardware mic
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
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

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="recorder-panel">
      <span className="eyebrow">IN-BROWSER AUDIO RECORDER (MOBILE OPTIMIZED)</span>

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

          <canvas ref={canvasRef} width="500" height="60" className="waveform-canvas" />

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
