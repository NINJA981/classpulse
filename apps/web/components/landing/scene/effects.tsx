'use client';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, TiltShift2, ToneMapping, Vignette, type TiltShiftEffect } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo, useRef } from 'react';
import { useFrameState, type QualityTier } from './frame-state';

/**
 * Post stack. Order matters: AO and bloom work on linear HDR, tilt-shift + vignette shape the
 * miniature look, tone mapping is last.
 * Why the high bloom threshold: only the pulse-yellow emissives (LED, rings, chunks, phones) exceed
 * it, so the brand colour is literally the only thing that glows.
 *
 * Tiers (story/gpu.ts): 'high' adds N8AO and 4× MSAA; 'low' (integrated GPUs, phones) is bloom +
 * tilt-shift + vignette + tone mapping in one merged pass with no MSAA — the fewest extra buffers.
 * `enabled = false` (the warm-up) skips the composer while shaders compile.
 */
export function Effects({ tier, enabled = true }: { tier: QualityTier; enabled?: boolean }) {
  const fs = useFrameState();
  const tiltRef = useRef<TiltShiftEffect>(null);
  // Stable arrays: the band is moved by writing into them each frame, never through React.
  const band = useMemo(() => ({ start: [0, 0.5] as [number, number], end: [1, 0.5] as [number, number] }), []);

  // Why: a horizontal band of focus = toy-town miniature. The band follows the shot's subject
  // (camera-rig.tsx projects it into fs.focusY), so the sharp strip is always where the story is.
  useFrame(() => {
    const t = tiltRef.current;
    if (!t) return;
    // start/end are [x, y] in 0…1 screen space (y up); the uniforms hold these very arrays.
    t.start[1] = fs.focusY;
    t.end[1] = fs.focusY;
  });

  const bloom = <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />;
  const tilt = (
    <TiltShift2
      ref={tiltRef}
      blur={tier === 'high' ? 0.14 : 0.1}
      taper={0.42}
      start={band.start}
      end={band.end}
      samples={tier === 'high' ? 8 : 6}
    />
  );
  const vignette = <Vignette offset={0.32} darkness={0.3} />;
  // Why: Khronos PBR Neutral keeps the brand colours (mint, board green, pulse yellow) true; AgX
  // and ACES both pushed the mint walls to grey and the yellow towards white in testing.
  const tone = <ToneMapping mode={ToneMappingMode.NEUTRAL} />;

  if (tier === 'high') {
    return (
      <EffectComposer enabled={enabled} multisampling={4} enableNormalPass={false}>
        <N8AO aoRadius={0.55} intensity={2.2} distanceFalloff={0.6} quality="low" halfRes depthAwareUpsampling color="#1d2a24" />
        {bloom}
        {tilt}
        {vignette}
        {tone}
      </EffectComposer>
    );
  }
  return (
    <EffectComposer enabled={enabled} multisampling={0} enableNormalPass={false}>
      {bloom}
      {tilt}
      {vignette}
      {tone}
    </EffectComposer>
  );
}
