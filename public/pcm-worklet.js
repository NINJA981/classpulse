// Turns live microphone audio into the frames Sarvam's realtime API expects:
// mono 16-bit PCM at 16 kHz, in ~100 ms blocks.
//
// The AudioContext is created with sampleRate 16000, so the browser has already resampled
// by the time audio reaches here. All this does is buffer 128-frame blocks up to 1600
// samples (100 ms) and hand them to the main thread as Int16.

const SAMPLES_PER_MESSAGE = 1600; // 100ms at 16kHz

class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(SAMPLES_PER_MESSAGE);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.offset] = channel[i];
      this.offset += 1;

      if (this.offset === SAMPLES_PER_MESSAGE) {
        const pcm = new Int16Array(SAMPLES_PER_MESSAGE);
        for (let s = 0; s < SAMPLES_PER_MESSAGE; s += 1) {
          // Float -1..1 to signed 16-bit, clamped so a loud room cannot wrap around.
          const clamped = Math.max(-1, Math.min(1, this.buffer[s]));
          pcm[s] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-worklet', PcmWorklet);
