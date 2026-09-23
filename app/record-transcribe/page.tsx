'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Radio,
  Mic,
  Video,
  Monitor,
  Play,
  Square,
  Pause,
  RotateCcw,
  Copy,
  Download,
  Sparkles,
  FileText,
  Search,
  Check,
  Volume2
} from 'lucide-react';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
}

const SAMPLE_TRANSCRIPTION_STREAM: TranscriptSegment[] = [
  {
    id: 'seg_1',
    timestamp: '00:04',
    speaker: 'Prof. Sharma',
    text: 'Good morning everyone. Today we are diving into cellular energetics, specifically focusing on the Citric Acid or Krebs Cycle.'
  },
  {
    id: 'seg_2',
    timestamp: '00:18',
    speaker: 'Prof. Sharma',
    text: 'Before we discuss the matrix reactions, let us review where pyruvate originates. Pyruvate is produced during glycolysis in the cytoplasm.'
  },
  {
    id: 'seg_3',
    timestamp: '00:35',
    speaker: 'Prof. Sharma',
    text: 'Upon entering the mitochondrial matrix through active transport, pyruvate undergoes oxidative decarboxylation, catalyzed by the pyruvate dehydrogenase complex.'
  },
  {
    id: 'seg_4',
    timestamp: '00:52',
    speaker: 'Prof. Sharma',
    text: 'Notice that one carbon atom is eliminated as carbon dioxide, while NAD+ is reduced to NADH + H+. The remaining two-carbon acetyl group bonds to coenzyme A.'
  },
  {
    id: 'seg_5',
    timestamp: '01:10',
    speaker: 'Prof. Sharma',
    text: 'This generates Acetyl-CoA, which delivers the acetyl group directly to oxaloacetate, yielding citrate and kickstarting our cycle.'
  }
];

export default function RecordTranscribePage() {
  const router = useRouter();

  // Mode: audio, video, screen
  const [recordMode, setRecordMode] = useState<'audio' | 'video' | 'screen'>('audio');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(30);

  // Transcripts
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>(SAMPLE_TRANSCRIPTION_STREAM);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Active session metadata
  const [sessionTitle, setSessionTitle] = useState('Cellular Respiration & Krebs Cycle');
  const [sessionClass, setSessionClass] = useState('Grade 10 - Section B');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Load session from storage if created from New Lesson
  useEffect(() => {
    try {
      const stored = localStorage.getItem('clasepulse_active_live_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.title) setSessionTitle(parsed.title);
        if (parsed.className) setSessionClass(parsed.className);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Timer & waveform animation loop
  useEffect(() => {
    let interval: any;
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

  // Handle camera / screen stream
  const startMediaStream = async () => {
    try {
      if (recordMode === 'video') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else if (recordMode === 'screen') {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn('Device media access unavailable or permission denied, using simulated capture:', err);
    }
  };

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleStartRecording = async () => {
    setIsRecording(true);
    setIsPaused(false);
    await startMediaStream();

    // Append simulated live streaming speech text every 8 seconds
    const interval = setTimeout(() => {
      const minutes = Math.floor((elapsedSeconds + 8) / 60);
      const seconds = (elapsedSeconds + 8) % 60;
      const stamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const newSeg: TranscriptSegment = {
        id: 'seg_' + Date.now(),
        timestamp: stamp,
        speaker: 'Prof. Sharma',
        text: 'Pay close attention to substrate-level phosphorylation versus oxidative phosphorylation in the inner membrane.'
      };
      setTranscriptSegments((prev) => [...prev, newSeg]);
    }, 8000);

    return () => clearTimeout(interval);
  };

  const handlePauseRecording = () => {
    setIsPaused(!isPaused);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    stopMediaStream();
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

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">BROADCAST & AUTOMATED LECTURE CAPTURE</span>
          <h1>Record & Transcribe</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Live classroom audio & video capture engine with automated real-time Speech-to-Text transcription.
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
                  Input: Default High Definition Audio Device (48.0 kHz)
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
                Format: WebM / Opus Audio
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {!isRecording ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleStartRecording}
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
                No transcription match found.
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
              paddingTop: '1rem'
            }}
          >
            <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
              {transcriptSegments.length} speech blocks captured
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/notes-syllabus" className="btn btn-sm btn-secondary">
                <FileText size={12} /> Save to Notes
              </Link>
              <Link href="/lessons/new" className="btn btn-sm btn-primary">
                <Sparkles size={12} /> Convert to Quiz
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
