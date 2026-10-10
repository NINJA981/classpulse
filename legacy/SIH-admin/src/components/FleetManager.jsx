import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const FleetManager = () => {
  const { piNodes, toggleNodeMute, globalMute } = useClassPulse();

  return (
    <div className="cp-stack">
      {/* Fleet Header & Summary */}
      <div className="cp-page-header">
        <div>
          <span className="cp-eyebrow">Edge hardware</span>
          <h2 className="cp-h2">Raspberry Pi Fleet & Microphone Nodes</h2>
          <p className="cp-lead mt-3 max-w-2xl">
            Edge microphone hardware streaming 16kHz mono audio over secure WebSocket streams. Audio is processed transiently with zero permanent retention.
          </p>
        </div>

        <div className="cp-page-actions">
          <button className="cp-btn cp-btn-primary">
            <span aria-hidden="true">＋</span>
            <span>Provision New Pi Node</span>
          </button>
        </div>
      </div>

      {/* Node Cards Grid */}
      <div className="cp-grid-3">
        {piNodes.map((node) => {
          const isNodeMuted = globalMute || node.isMuted;

          return (
            <div
              key={node.id}
              className="cp-card flex flex-col justify-between gap-5"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="cp-detail-label">{node.id.toUpperCase()}</span>
                  <span className={`cp-badge inline-flex items-center gap-1.5 ${isNodeMuted ? 'is-muted' : node.status === 'streaming' ? 'is-ink' : 'is-outline'}`}>
                    <span aria-hidden="true">{isNodeMuted ? '○' : '●'}</span>
                    <span>{isNodeMuted ? 'Muted' : node.status}</span>
                  </span>
                </div>

                <h3 className="cp-h3">{node.classroom}</h3>
                <p className="cp-caption-2 mt-1">{node.ip}:{node.port}</p>
              </div>

              {/* Specs & Hardware Telemetry */}
              <div className="cp-card-sunken border border-line p-3 text-caption">
                <div className="cp-kv">
                  <span>Microphone:</span>
                  <span className="font-bold text-ink">{node.mic}</span>
                </div>

                <div className="cp-kv">
                  <span>Audio Latency:</span>
                  <span className="font-bold text-ink">~{(node.latencyMs / 1000).toFixed(1)}s</span>
                </div>

                <div className="cp-kv">
                  <span>CPU / Temp:</span>
                  <span className="font-bold text-ink">{node.cpu} • {node.temp}</span>
                </div>

                <div className="cp-kv">
                  <span>Active Topic:</span>
                  <span className="font-bold text-ink truncate max-w-[140px]">{node.activeTopic}</span>
                </div>
              </div>

              {/* Audio Level Indicator */}
              <div>
                <div className="cp-progress-meta flex justify-between mb-1.5">
                  <span>Mic VAD Signal Level</span>
                  <span>{isNodeMuted ? '0%' : `${node.audioLevel}%`}</span>
                </div>
                <div className="cp-progress is-thick">
                  <span
                    className={`cp-progress-fill ${isNodeMuted ? 'opacity-30' : ''}`}
                    style={{ width: isNodeMuted ? '0%' : `${node.audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Action Controls */}
              <div className="pt-4 border-t border-line-soft flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleNodeMute(node.id)}
                  className={`cp-toggle flex-1 inline-flex items-center justify-center gap-1.5 ${node.isMuted ? 'is-on' : ''}`}
                >
                  <span aria-hidden="true">{node.isMuted ? '○' : '●'}</span>
                  <span>{node.isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                </button>

                <span className="cp-badge is-outline inline-flex items-center gap-1">
                  <span aria-hidden="true">✓</span>
                  <span>Audio Auto-Deleted</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hardware & Privacy Compliance Policy Card */}
      <div className="cp-card flex items-start gap-4">
        <div className="cp-icon-box is-lg shrink-0" aria-hidden="true">▣</div>
        <div className="space-y-2 text-body leading-relaxed text-muted-4">
          <span className="cp-eyebrow is-tight">Compliance</span>
          <h4 className="cp-h4">ClassPulse Privacy & Zero Retention Protocol</h4>
          <p>
            Raw audio captured by classroom microphones is processed transiently in memory for Voice Activity Detection. Once text transcription is generated, the underlying raw audio data is <strong className="text-ink">permanently deleted from memory</strong> with zero disk storage.
          </p>
        </div>
      </div>
    </div>
  );
};
