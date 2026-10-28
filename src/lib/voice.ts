/**
 * voice.ts — record a short voice note in the browser and return it as
 * base64 16 kHz mono WAV.
 *
 * Browsers record in different containers (Chrome webm, Safari mp4), and not
 * every speech model accepts both. Decoding to WAV here means the engine gets
 * one format it can always read. 16 kHz mono is what speech models use
 * internally, so nothing is lost and a 30 second note stays under 1 MB.
 */

const RATE = 16000;
/** Older Safari can't render below 22.05 kHz; still fine for speech. */
const FALLBACK_RATE = 22050;
/** Long enough for any meal; stops a forgotten recording. */
export const MAX_SECONDS = 60;

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export interface Recording {
  /** Stop and return the note as base64 WAV. */
  stop(): Promise<string>;
  /** Stop and throw the audio away. */
  cancel(): void;
}

/** Asks for the microphone, then starts recording. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve();
    };
  });
  recorder.start();

  return {
    async stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: recorder.mimeType });
      return toWavBase64(await blob.arrayBuffer());
    },
    cancel() {
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}

async function toWavBase64(recorded: ArrayBuffer): Promise<string> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(recorded);
  void ctx.close();

  // Resample and mix down to mono in one pass.
  let rate = RATE;
  let offline: OfflineAudioContext;
  try {
    offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * rate),
      rate,
    );
  } catch {
    rate = FALLBACK_RATE;
    offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * rate),
      rate,
    );
  }
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const ascii = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }

  const bytes = new Uint8Array(view.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
