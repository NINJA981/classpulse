import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const AudioVisualizer = () => {
  const { audioLevels, globalMute, piNodes } = useClassPulse();
  const activeNode = piNodes.find(n => n.id === 'pi-01') || piNodes[0];

  const isMicMuted = globalMute || activeNode.isMuted;

  return (
    <div className="cp-card relative overflow-hidden">
      {/* Visualizer Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3">
          <div className={`cp-icon-box is-lg shrink-0 ${isMicMuted ? 'opacity-40' : 'is-ink'}`} aria-hidden="true">▤</div>
          <div>
            <span className="cp-eyebrow is-tight">Audio input</span>
            <h3 className="cp-h3 flex items-center gap-2 flex-wrap">
              Classroom Mic Stream
              <span className="cp-badge is-outline">
                Pi Zero 2 W
              </span>
            </h3>
            <p className="cp-caption mt-1">Live Voice Activity Detection • 16 kHz Audio Stream</p>
          </div>
        </div>

        {/* VAD & Noise Gate Status */}
        <div className="flex items-center gap-2">
          <span className={`cp-badge inline-flex items-center gap-1.5 ${isMicMuted ? 'is-muted' : 'is-ink'}`}>
            <span className={`cp-dot ${isMicMuted ? 'is-off' : 'is-live'}`} />
            <span>{isMicMuted ? 'Muted / Silenced' : 'Speech Active'}</span>
          </span>

          <span className="hidden sm:inline-flex cp-badge is-outline items-center gap-1">
            <span aria-hidden="true">✓</span>
            <span>Audio Auto-Deleted</span>
          </span>
        </div>
      </div>

      {/* Audio Spectrum Waveform Bars */}
      <div className="h-20 bg-track p-3 flex items-end justify-between gap-1 border border-line relative">
        {isMicMuted ? (
          <div className="w-full h-full flex items-center justify-center gap-2 text-ink font-black text-label uppercase tracking-label">
            <span aria-hidden="true">○</span>
            <span>Audio stream muted by teacher switch</span>
          </div>
        ) : (
          audioLevels.map((level, idx) => {
            const height = `${Math.max(10, level)}%`;
            const isPeak = level > 75;
            return (
              <div
                key={idx}
                className={`flex-1 bg-ink ${isPeak ? '' : 'opacity-60'}`}
                style={{ height, transition: 'height 0.2s ease' }}
              />
            );
          })
        )}
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap cp-caption-2 uppercase tracking-label">
        <span>Boundary Mic: Active (Gain 82%)</span>
        <span>Speech Delay: ~1.8s</span>
        <span>Noise Gate: Filtered</span>
      </div>
    </div>
  );
};
