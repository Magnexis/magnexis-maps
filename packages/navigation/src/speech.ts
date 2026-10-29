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

/** Web Speech Synthesis adapter — Magnexis VoiceNav */
export function createBrowserSpeechService(): NavigationSpeechService {
  if (Capacitor.isNativePlatform()) return createNativeSpeechService();
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
      // Warm voice list (Chrome populates asynchronously)
      window.speechSynthesis.getVoices();
    },
    async speak(text: string) {
      if (!hasSpeech || muted || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const match = voiceURI
        ? voices.find((v) => v.voiceURI === voiceURI)
        : voices.find((v) => v.lang.startsWith("en"));
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
    },
    async speak(text) {
      if (muted || !text.trim()) return;
      const voice = voiceURI
        ? voices.findIndex((item) => item.voiceURI === voiceURI)
        : -1;
      await plugin
        .speak({
          text,
          lang: "en-US",
          rate,
          category: "ambient",
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
