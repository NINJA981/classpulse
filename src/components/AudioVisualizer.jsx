import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import { Volume2, VolumeX, ShieldCheck, Cpu, Waves, Activity } from 'lucide-react';

export const AudioVisualizer = () => {
  const { audioLevels, globalMute, piNodes } = useClassPulse();
  const activeNode = piNodes.find(n => n.id === 'pi-01') || piNodes[0];

  const isMicMuted = globalMute || activeNode.isMuted;

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-200 relative overflow-hidden">
      {/* Visualizer Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isMicMuted ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Classroom Mic Stream
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                Pi Zero 2 W
              </span>
            </h3>
            <p className="text-xs text-slate-500">Live Voice Activity Detection • 16 kHz Audio Stream</p>
          </div>
        </div>

        {/* VAD & Noise Gate Status */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isMicMuted
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isMicMuted ? 'Muted / Silenced' : 'Speech Active'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Audio Auto-Deleted</span>
          </div>
        </div>
      </div>

      {/* Audio Spectrum Waveform Bars */}
      <div className="h-20 bg-slate-50 rounded-xl p-3 flex items-end justify-between gap-1 border border-slate-200 relative">
        {isMicMuted ? (
          <div className="w-full h-full flex items-center justify-center gap-2 text-rose-600 font-semibold text-xs">
            <VolumeX className="w-4 h-4" />
            <span>Audio stream muted by teacher switch</span>
          </div>
        ) : (
          audioLevels.map((level, idx) => {
            const height = `${Math.max(10, level)}%`;
            const isPeak = level > 75;
            return (
              <div
                key={idx}
                className={`flex-1 rounded-t-sm transition-all duration-150 ${
                  isPeak
                    ? 'bg-indigo-600 shadow-xs'
                    : 'bg-indigo-400/85'
                }`}
                style={{ height }}
              />
            );
          })
        )}
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>Boundary Mic: Active (Gain 82%)</span>
        <span>Speech Delay: ~1.8s</span>
        <span>Noise Gate: Filtered</span>
      </div>
    </div>
  );
};
