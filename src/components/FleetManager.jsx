import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  Cpu,
  Radio,
  Volume2,
  VolumeX,
  ShieldCheck,
  Zap,
  HardDrive,
  Activity,
  CheckCircle2,
  Lock,
  Plus
} from 'lucide-react';

export const FleetManager = () => {
  const { piNodes, toggleNodeMute, globalMute } = useClassPulse();

  return (
    <div className="space-y-6">
      {/* Fleet Header & Summary */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Raspberry Pi Fleet & Microphone Nodes</h2>
          </div>
          <p className="text-xs text-slate-500">
            Edge microphone hardware streaming 16kHz mono audio over secure WebSocket streams. Audio is processed transiently with zero permanent retention.
          </p>
        </div>

        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm">
          <Plus className="w-4 h-4" />
          <span>Provision New Pi Node</span>
        </button>
      </div>

      {/* Node Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {piNodes.map((node) => {
          const isNodeMuted = globalMute || node.isMuted;

          return (
            <div
              key={node.id}
              className="glass-card rounded-2xl p-5 border border-slate-200 flex flex-col justify-between space-y-4 hover:border-slate-300 transition shadow-xs"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-700 font-mono">{node.id.toUpperCase()}</span>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isNodeMuted
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : node.status === 'streaming'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    <span>{isNodeMuted ? 'Muted' : node.status}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900">{node.classroom}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{node.ip}:{node.port}</p>
              </div>

              {/* Specs & Hardware Telemetry */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Microphone:</span>
                  <span className="text-slate-800 font-semibold">{node.mic}</span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Audio Latency:</span>
                  <span className="text-indigo-700 font-semibold">~{(node.latencyMs / 1000).toFixed(1)}s</span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>CPU / Temp:</span>
                  <span className="text-slate-800 font-semibold">{node.cpu} • {node.temp}</span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Active Topic:</span>
                  <span className="text-emerald-700 font-semibold truncate max-w-[140px]">{node.activeTopic}</span>
                </div>
              </div>

              {/* Audio Level Indicator */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                  <span>Mic VAD Signal Level</span>
                  <span>{isNodeMuted ? '0%' : `${node.audioLevel}%`}</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isNodeMuted ? 'bg-slate-300' : 'bg-indigo-600'
                    }`}
                    style={{ width: isNodeMuted ? '0%' : `${node.audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Action Controls */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleNodeMute(node.id)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    node.isMuted
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  {node.isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-600" /> : <Volume2 className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{node.isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                </button>

                <div className="px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Audio Auto-Deleted</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hardware & Privacy Compliance Policy Card */}
      <div className="glass-card rounded-2xl p-5 border border-slate-200 flex items-start gap-4 bg-emerald-50/40 shadow-xs">
        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 border border-emerald-200">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1 text-xs leading-relaxed text-slate-700">
          <h4 className="font-bold text-slate-900 text-sm">ClassPulse Privacy & Zero Retention Protocol</h4>
          <p>
            Raw audio captured by classroom microphones is processed transiently in memory for Voice Activity Detection. Once text transcription is generated, the underlying raw audio data is <strong>permanently deleted from memory</strong> with zero disk storage.
          </p>
        </div>
      </div>
    </div>
  );
};
