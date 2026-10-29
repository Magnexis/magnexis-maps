import { Capacitor, registerPlugin } from "@capacitor/core";
import type { TextToSpeechPlugin } from "@capacitor-community/text-to-speech";

export interface NavigationSpeechService {
  readonly available: boolean;
  initialize(): Promise<void>;
  speak(text: string): Promise<void>;
  stop(): void;
  mute(): void;
  unmute(): void;
  setRate(rate: number): void;
  isMuted(): boolean;
  listVoices(): SpeechSynthesisVoice[];
  selectVoice(voiceURI: string | null): void;
  dispose(): void;
}

type CloudTtsFetcher = (text: string) => Promise<ArrayBuffer | null>;

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;
  if (v.lang?.toLowerCase().startsWith("en")) score += 20;
  if (v.localService === false) score += 8; // often neural / network voices
  if (/neural|premium|enhanced|natural|siri|google|microsoft|jenny|aria|guy|sara|ava|evan|zoe|nicky|samantha|karen|daniel|moira|tessa|rishi|fiona/.test(name)) {
    score += 30;
  }
  if (/compact|eloquence|robot|monotone/.test(name)) score -= 15;
  return score;
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  voiceURI: string | null,
): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const match = voices.find((v) => v.voiceURI === voiceURI);
    if (match) return match;
  }
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0];
}

async function playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  try {
    const audio = new Audio(url);
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      void audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Optional high-quality cloud TTS (OpenAI / ElevenLabs via Magnexis API).
 * Falls back to device/browser speech when unavailable.
 */
export function createCloudAwareSpeechService(options?: {
  fetchAudio?: CloudTtsFetcher;
  fallback?: NavigationSpeechService;
}): NavigationSpeechService {
  const fallback =
    options?.fallback ??
    (Capacitor.isNativePlatform()
      ? createNativeSpeechService()
      : createWebSpeechService());
  const fetchAudio = options?.fetchAudio;
  let muted = false;
  let rate = 1;

  return {
    available: true,
    async initialize() {
      await fallback.initialize();
    },
    async speak(text: string) {
      if (muted || !text.trim()) return;
      if (fetchAudio) {
        try {
          const buffer = await fetchAudio(text);
          if (buffer && buffer.byteLength > 0) {
            await playAudioBuffer(buffer);
            return;
          }
        } catch {
          // fall through to device TTS
        }
      }
      fallback.setRate(rate);
      await fallback.speak(text);
    },
    stop() {
      fallback.stop();
    },
    mute() {
      muted = true;
      fallback.mute();
    },
    unmute() {
      muted = false;
      fallback.unmute();
    },
    setRate(next) {
      rate = Math.min(2, Math.max(0.5, next));
      fallback.setRate(rate);
    },
    isMuted() {
      return muted;
    },
    listVoices() {
      return fallback.listVoices();
    },
    selectVoice(uri) {
      fallback.selectVoice(uri);
    },
    dispose() {
      fallback.dispose();
    },
  };
}

/** Web Speech Synthesis adapter — Magnexis VoiceNav */
export function createWebSpeechService(): NavigationSpeechService {
  const hasSpeech =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined";

  let muted = false;
  let rate = 1;
  let voiceURI: string | null = null;
  let speaking = false;

  return {
    available: hasSpeech,
    async initialize() {
      if (!hasSpeech) return;
      window.speechSynthesis.getVoices();
      // Chrome populates voices asynchronously
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        window.speechSynthesis.addEventListener("voiceschanged", done, {
          once: true,
        });
        setTimeout(done, 400);
      });
    },
    async speak(text: string) {
      if (!hasSpeech || muted || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const match = pickBestVoice(voices, voiceURI);
      if (match) utter.voice = match;
      speaking = true;
      await new Promise<void>((resolve) => {
        utter.onend = () => {
          speaking = false;
          resolve();
        };
        utter.onerror = () => {
          speaking = false;
          resolve();
        };
        window.speechSynthesis.speak(utter);
      });
      void speaking;
    },
    stop() {
      if (hasSpeech) window.speechSynthesis.cancel();
      speaking = false;
    },
    mute() {
      muted = true;
      this.stop();
    },
    unmute() {
      muted = false;
    },
    setRate(next) {
      rate = Math.min(2, Math.max(0.5, next));
    },
    isMuted() {
      return muted;
    },
    listVoices() {
      if (!hasSpeech) return [];
      return window.speechSynthesis.getVoices();
    },
    selectVoice(uri) {
      voiceURI = uri;
    },
    dispose() {
      this.stop();
    },
  };
}

/** @deprecated Prefer createWebSpeechService / createCloudAwareSpeechService */
export function createBrowserSpeechService(): NavigationSpeechService {
  if (Capacitor.isNativePlatform()) return createNativeSpeechService();
  return createWebSpeechService();
}

/** The iPhone uses AVSpeechSynthesizer rather than relying on WKWebView speech support. */
export function createNativeSpeechService(
  plugin: TextToSpeechPlugin = registerPlugin<TextToSpeechPlugin>(
    "TextToSpeech",
  ),
): NavigationSpeechService {
  let muted = false;
  let rate = 1;
  let voices: SpeechSynthesisVoice[] = [];
  let voiceURI: string | null = null;
  const stop = () => {
    void plugin
      .stop()
      .catch(() => console.warn("Native speech could not be stopped."));
  };
  return {
    available: true,
    async initialize() {
      const result = await plugin
        .getSupportedVoices()
        .catch(() => ({ voices: [] }));
      voices = result.voices;
      // Prefer enhanced / premium voices when the caller did not pick one.
      if (!voiceURI && voices.length) {
        const best = pickBestVoice(voices, null);
        if (best) voiceURI = best.voiceURI;
      }
    },
    async speak(text) {
      if (muted || !text.trim()) return;
      const voice = voiceURI
        ? voices.findIndex((item) => item.voiceURI === voiceURI)
        : -1;
      // Slightly slower than 1.0 reads clearer on road guidance.
      const nativeRate = Math.min(1.05, Math.max(0.85, rate * 0.95));
      await plugin
        .speak({
          text,
          lang: "en-US",
          rate: nativeRate,
          pitch: 1.05,
          category: "playback",
          ...(voice >= 0 ? { voice } : {}),
        })
        .catch(() => console.warn("Native voice guidance is unavailable."));
    },
    stop,
    mute() {
      muted = true;
      stop();
    },
    unmute() {
      muted = false;
    },
    setRate(value) {
      rate = Number.isFinite(value) ? Math.min(2, Math.max(0.5, value)) : 1;
    },
    isMuted() {
      return muted;
    },
    listVoices() {
      return voices;
    },
    selectVoice(value) {
      voiceURI = value;
    },
    dispose: stop,
  };
}
