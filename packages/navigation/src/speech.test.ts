import { beforeEach, describe, expect, it, vi } from "vitest";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { createNativeSpeechService } from "./speech";

vi.mock("@capacitor-community/text-to-speech", () => ({
  TextToSpeech: {
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getSupportedVoices: vi
      .fn()
      .mockResolvedValue({
        voices: [
          {
            voiceURI: "native-voice",
            name: "English",
            lang: "en-US",
            localService: true,
            default: true,
          },
        ],
      }),
  },
}));
beforeEach(() => vi.clearAllMocks());
describe("native voice guidance", () => {
  it("speaks the real instruction using the selected device voice and rate", async () => {
    const speech = createNativeSpeechService(TextToSpeech);
    await speech.initialize();
    speech.selectVoice("native-voice");
    speech.setRate(1.5);
    await speech.speak("Turn right onto Chapel Street");
    expect(TextToSpeech.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Turn right onto Chapel Street",
        voice: 0,
        rate: 1.5,
        category: "ambient",
      }),
    );
  });
  it("muting cancels speech and prevents new announcements", async () => {
    const speech = createNativeSpeechService(TextToSpeech);
    speech.mute();
    await speech.speak("Turn right");
    expect(TextToSpeech.stop).toHaveBeenCalledOnce();
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
    speech.unmute();
    await speech.speak("Turn right");
    expect(TextToSpeech.speak).toHaveBeenCalledOnce();
  });
  it("clamps invalid rates and stops when disposed", async () => {
    const speech = createNativeSpeechService(TextToSpeech);
    speech.setRate(NaN);
    await speech.speak("Continue");
    expect(TextToSpeech.speak).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 1 }),
    );
    speech.dispose();
    expect(TextToSpeech.stop).toHaveBeenCalledOnce();
  });
});
