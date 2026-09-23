'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Video,
  Monitor,
  Play,
  Square,
  Pause,
  Copy,
  Sparkles,
  FileText,
  Search,
  Check
} from 'lucide-react';
import LiveTranscript from '../../components/LiveTranscript';
import { api } from '../../lib/api';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

interface StoredLiveSession {
  lessonId?: string;
  title?: string;
  subject?: string;
  className?: string;
  sectionId?: string;
}

/** The first recording container the browser can actually produce. */
function pickMimeType(video: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = video
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export default function RecordTranscribePage() {
  const router = useRouter();

  // Mode: audio, video, screen
  const [recordMode, setRecordMode] = useState<'audio' | 'video' | 'screen'>('audio');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(30);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [captureError, setCaptureError] = useState('');

  // The live MediaStream, shared with the caption relay.
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Transcripts (each finalised live-caption line becomes a segment)
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Convert-to-quiz state
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState('');

  // Active session metadata (real when launched from New Lesson, generic otherwise)
  const [session, setSession] = useState<StoredLiveSession>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('');
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsedSeconds;

  // Load session from storage if created from New Lesson
  useEffect(() => {
    try {
      const stored = localStorage.getItem('clasepulse_active_live_session');
      if (stored) setSession(JSON.parse(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Timer & waveform animation loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setAudioLevel(Math.floor(20 + Math.random() * 65));
      }, 1000);
    } else {
      setAudioLevel(10);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setMediaStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopMediaStream, [stopMediaStream]);

  const handleStartRecording = async () => {
    setCaptureError('');
    setConvertError('');
    setRecordingBlob(null);
    setTranscriptSegments([]);
    setElapsedSeconds(0);

    let stream: MediaStream;
    try {
      if (recordMode === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        // Screen shares often come without audio; the lecture needs the mic regardless.
        if (stream.getAudioTracks().length === 0) {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getAudioTracks().forEach((track) => stream.addTrack(track));
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: recordMode === 'video',
          audio: true
        });
      }
    } catch (err) {
      setCaptureError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access was refused. Allow the microphone for this site and try again.'
          : 'Could not open the microphone or camera on this device. Recording needs HTTPS or localhost.'
      );
      return;
    }

    const mimeType = pickMimeType(recordMode !== 'audio');
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      setCaptureError('This browser cannot record media (MediaRecorder unsupported).');
      return;
    }

    mediaStreamRef.current = stream;
    setMediaStream(stream);
    if (videoRef.current && recordMode !== 'audio') {
      videoRef.current.srcObject = stream;
    }

    chunksRef.current = [];
    mimeTypeRef.current = mimeType;
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      setRecordingBlob(new Blob(chunksRef.current, { type: mimeTypeRef.current }));
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);

    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (isPaused) recorder.resume();
    else recorder.pause();
    setIsPaused(!isPaused);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    stopMediaStream();
  };

  /** Every finalised live-caption line lands in the editable transcript feed. */
  const handleFinalLine = useCallback((line: string) => {
    const total = elapsedRef.current;
    const stamp = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    setTranscriptSegments((prev) => [
      ...prev,
      { id: 'seg_' + Date.now() + '_' + prev.length, timestamp: stamp, speaker: 'Teacher', text: line }
    ]);
  }, []);

  /**
   * The whole point of the console: recorded audio in, quiz pipeline out.
   *
   * A session launched from New Lesson already owns a lesson; otherwise one is created
   * against a real section (the live captions saved server-side are claimed automatically).
   */
  const handleConvertToQuiz = async () => {
    if (!recordingBlob) {
      setConvertError('Record the lecture first — stop the recording, then convert it.');
      return;
    }
    setConvertError('');
    setIsConverting(true);

    try {
      let lessonId = session.lessonId;

      if (!lessonId) {
        let className = session.className;
        let sectionId = session.sectionId;
        if (!sectionId) {
          const sections = await api.listSections();
          if (sections.length === 0) {
            throw new Error('No class sections exist yet. Create one in the admin console first.');
          }
          className = sections[0].name;
          sectionId = sections[0].id;
        }
        const lesson = await api.createLesson({
          title: session.title?.trim() || `Recorded lecture — ${new Date().toLocaleDateString()}`,
          subject: session.subject?.trim() || 'General',
          className: className || 'Unassigned',
          sectionId
        });
        lessonId = lesson._id;
      }

      await api.attachSource(lessonId, recordingBlob, 'audio');
      await api.generate(lessonId);
      localStorage.removeItem('clasepulse_active_live_session');
      router.push(`/lessons/${lessonId}`);
    } catch (err: any) {
      setConvertError(err?.message || 'Could not start quiz generation. Please try again.');
      setIsConverting(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyTranscript = () => {
    const fullText = transcriptSegments
      .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleTextEdit = (id: string, newText: string) => {
    setTranscriptSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, text: newText } : seg))
    );
  };

  const filteredSegments = transcriptSegments.filter((seg) =>
    seg.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const sessionTitle = session.title || 'Classroom Lecture';
  const sessionClass = session.className || 'No section linked yet';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">BROADCAST & AUTOMATED LECTURE CAPTURE</span>
          <h1>Record & Transcribe</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Live classroom audio & video capture with real-time speech-to-text transcription.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            onClick={() => router.push('/lessons/new')}
            className="btn btn-secondary"
          >
            Switch Class / Topic
          </button>
        </div>
      </div>

      {/* Active Session Info Bar */}
      <div
        className="card card-solid mb-4"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '1rem 1.5rem',
          background: isRecording ? '#fffef2' : 'var(--surface)',
          borderColor: isRecording ? 'var(--ink)' : 'var(--hairline)'
        }}
      >
        <div>
          <span className="eyebrow">ACTIVE CLASSROOM CONTEXT</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.25rem' }}>{sessionTitle}</h2>
            <span className="timetable-tag">{sessionClass}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <span className="eyebrow" style={{ margin: 0 }}>RECORDER CLOCK</span>
            <div className="text-mono" style={{ fontSize: '1.5rem', fontWeight: 900 }}>
              {formatTimer(elapsedSeconds)}
            </div>
          </div>

          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-rec-dot" />
              <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em' }}>
                {isPaused ? 'PAUSED' : 'RECORDING LIVE'}
              </span>
            </div>
          )}
        </div>
      </div>

      {captureError && (
        <div
          className="card card-solid mb-4"
          style={{ padding: '0.9rem 1.25rem', borderColor: '#c93c1c', color: '#c93c1c', fontWeight: 700, fontSize: '13px' }}
        >
          {captureError}
        </div>
      )}

      {/* Main Two Column Layout: Media Console on Left, Transcription on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}
      >
        {/* LEFT COLUMN: Media Recorder Console */}
        <div className="card card-solid" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Mode Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span className="eyebrow">MEDIA INPUT SOURCE</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'audio', label: 'Audio Mic', icon: Mic },
                { key: 'video', label: 'Webcam', icon: Video },
                { key: 'screen', label: 'Screen Share', icon: Monitor }
              ].map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    disabled={isRecording}
                    className={`btn btn-sm ${recordMode === mode.key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setRecordMode(mode.key as any)}
                  >
                    <Icon size={12} /> {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Viewport Box */}
          <div className="recorder-viewport mb-3">
            {recordMode === 'audio' ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    margin: '0 auto 1rem',
                    border: '2px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isRecording ? '#ff2222' : '#222'
                  }}
                >
                  <Mic size={32} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.06em' }}>
                  {isRecording ? 'Capturing Microphone Stream' : 'Microphone Ready'}
                </div>
                <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
                  {isRecording
                    ? `Recording as ${mimeTypeRef.current || 'browser default'}`
                    : 'Uses this device’s default microphone (HTTPS or localhost required).'}
                </p>

                {/* Live Waveform Indicator */}
                {isRecording && (
                  <div className="waveform-container" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
                    {[12, 28, 45, audioLevel, 32, 54, audioLevel * 0.7, 40, 20, 35].map((val, idx) => (
                      <div
                        key={idx}
                        className="waveform-bar"
                        style={{
                          background: '#fff',
                          height: `${Math.max(4, Math.min(36, val))}px`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '360px', objectFit: 'cover' }}
                />
                {!isRecording && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.6)'
                    }}
                  >
                    <p style={{ color: '#fff', fontWeight: 700 }}>
                      Click "Start Recording" to activate {recordMode === 'video' ? 'Camera' : 'Screen Share'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              borderTop: '1px solid var(--hairline)',
              paddingTop: '1rem'
            }}
          >
            <div>
              <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
                {recordingBlob
                  ? `Saved recording: ${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`
                  : 'Format: WebM / Opus Audio'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {!isRecording ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleStartRecording}
                  disabled={isConverting}
                >
                  <Play size={16} /> Start Recording
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePauseRecording}
                  >
                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleStopRecording}
                  >
                    <Square size={14} /> Stop & Save
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live captions tap the same stream the recorder uses. When the session came
              from New Lesson the lesson already exists, so captions save straight onto it. */}
          <LiveTranscript
            stream={mediaStream}
            active={isRecording && !isPaused}
            language="auto"
            lessonId={session.lessonId}
            onFinalLine={handleFinalLine}
          />
        </div>

        {/* RIGHT COLUMN: Automated Live Speech Transcription */}
        <div className="card card-solid" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span className="eyebrow">AUTOMATED SPEECH-TO-TEXT ENGINE</span>
              <h2 style={{ fontSize: '1.25rem' }}>Live Lecture Transcript</h2>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCopyTranscript}
                title="Copy full text"
              >
                {copiedNotification ? <Check size={12} /> : <Copy size={12} />}
                {copiedNotification ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid var(--hairline)',
              padding: '6px 10px',
              marginBottom: '1rem',
              background: 'var(--surface-alt)'
            }}
          >
            <Search size={14} className="text-secondary" />
            <input
              type="text"
              placeholder="Search transcript keywords..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', fontSize: '12px' }}
            />
          </div>

          {/* Transcript Feed / Editor */}
          <div
            style={{
              flex: 1,
              maxHeight: '400px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid var(--hairline)',
              padding: '1rem',
              background: 'var(--surface)'
            }}
          >
            {filteredSegments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>
                {isRecording
                  ? 'Listening… finalised sentences appear here as you speak.'
                  : 'Start a recording and the live transcript will appear here.'}
              </div>
            ) : (
              filteredSegments.map((seg) => (
                <div
                  key={seg.id}
                  style={{
                    padding: '8px 10px',
                    borderLeft: '2px solid var(--ink)',
                    background: '#fcfcf9'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.06em' }}>
                      {seg.speaker}
                    </span>
                    <span className="text-mono text-secondary" style={{ fontSize: '10px' }}>
                      [{seg.timestamp}]
                    </span>
                  </div>

                  <input
                    type="text"
                    value={seg.text}
                    onChange={(e) => handleTextEdit(seg.id, e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      fontSize: '13px',
                      color: '#111',
                      padding: 0,
                      outline: 'none',
                      lineHeight: 1.4
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Actions at bottom */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem',
              borderTop: '1px solid var(--hairline)',
              paddingTop: '1rem',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
              {transcriptSegments.length} speech blocks captured
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/notes-syllabus" className="btn btn-sm btn-secondary">
                <FileText size={12} /> Save to Notes
              </Link>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleConvertToQuiz}
                disabled={isConverting || isRecording || !recordingBlob}
                title={!recordingBlob ? 'Stop a recording first' : 'Generate a quiz from this recording'}
              >
                <Sparkles size={12} /> {isConverting ? 'Generating…' : 'Convert to Quiz'}
              </button>
            </div>
          </div>

          {convertError && (
            <p style={{ color: '#c93c1c', fontWeight: 700, fontSize: '12px', marginTop: '8px' }}>
              {convertError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
