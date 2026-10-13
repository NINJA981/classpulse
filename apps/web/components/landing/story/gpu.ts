/**
 * Can this device run the live 3D room, and at what quality?
 *
 * Why so strict: the room shares memory with everything else on integrated GPUs. On a Radeon 610M
 * (Chromium on D3D11, the system low on RAM) the high-quality path ran the GPU out of memory: the
 * post-processing shader failed to link, then the WebGL context was lost and the stage went blank.
 * The posters are frames of the same room, so a device that can't run it well loses very little.
 *
 * - 'high': discrete GPUs on desktop-sized screens with plenty of memory.
 * - 'low' : integrated / mobile GPUs, phones, small or modest machines, unknown renderers.
 * - null  : no live room — no WebGL2, software rendering, < 4 GB memory or < 4 cores, Save-Data,
 *           or the live room already failed once this session.
 */
export type GpuTier = 'high' | 'low';
export interface Capability {
  tier: GpuTier | null;
  /** Why (for the console and tests). */
  reason: string;
  renderer: string;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|mesa offscreen|gdi generic/i;
// Integrated and mobile GPUs. AMD APUs report "Radeon(TM) Graphics", "Radeon(TM) 610M/680M/780M", "Vega 8".
const INTEGRATED =
  /intel|radeon(?:\(tm\))?\s*(?:graphics|vega|\d{3}m)\b|\bvega\s*\d|mali|adreno|powervr|apple|videocore|immortalis|xclipse|samsung/i;
// Intel Arc A-series cards are discrete (the Meteor Lake iGPU is plain "Arc(TM) Graphics").
const DISCRETE_INTEL = /arc(?:\(tm\))?\s*a\d{3}/i;

const SESSION_KEY = 'cp:landing-3d';

/** The live room failed (context lost, shader link error, too slow …): posters for the rest of the session. */
export function markLiveFailed(reason: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, `off:${reason}`);
  } catch {
    // Storage blocked: the in-memory state in the stage still holds for this page view.
  }
}

function failedThisSession(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    return v?.startsWith('off:') ? v.slice(4) : null;
  } catch {
    return null;
  }
}

/** `?gl=off|low|high` — a manual override for testing on any machine. */
function override(): GpuTier | 'off' | null {
  const v = new URLSearchParams(window.location.search).get('gl');
  return v === 'off' || v === 'low' || v === 'high' ? v : null;
}

let cached: Capability | undefined;

/** Probes once (creating a WebGL context costs time, so only call it once the visitor engages). */
export function detectCapability(): Capability {
  if (cached) return cached;
  cached = probe();
  return cached;
}

function probe(): Capability {
  const forced = override();
  if (forced === 'off') return { tier: null, reason: 'forced off (?gl=off)', renderer: '' };
  const failed = failedThisSession();
  if (failed && !forced) return { tier: null, reason: `failed earlier this session (${failed})`, renderer: '' };

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData && !forced) return { tier: null, reason: 'Save-Data', renderer: '' };

  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    // Why failIfMajorPerformanceCaveat: the browser refuses it when it would fall back to software GL.
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return { tier: null, reason: 'no hardware WebGL2', renderer };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return { tier: null, reason: 'WebGL2 probe threw', renderer };
  }

  if (forced) return { tier: forced, reason: `forced (?gl=${forced})`, renderer };
  if (SOFTWARE.test(renderer)) return { tier: null, reason: 'software renderer', renderer };

  const memory = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  if (memory !== undefined && memory < 4) return { tier: null, reason: `deviceMemory ${memory} GB`, renderer };
  if (cores !== undefined && cores < 4) return { tier: null, reason: `${cores} cores`, renderer };

  const integrated = INTEGRATED.test(renderer) && !DISCRETE_INTEL.test(renderer);
  const phoneish =
    window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700;
  const modest = (memory !== undefined && memory < 8) || (cores !== undefined && cores < 8);
  // Masked renderer strings (privacy modes) tell us nothing: assume the cautious tier.
  const unknown = renderer === '' || /^(webkit webgl|mozilla|generic)/i.test(renderer);
  if (integrated || phoneish || modest || unknown) {
    const why = integrated ? 'integrated GPU' : phoneish ? 'phone / small screen' : modest ? 'modest device' : 'unknown GPU';
    return { tier: 'low', reason: why, renderer };
  }
  return { tier: 'high', reason: 'discrete GPU', renderer };
}
