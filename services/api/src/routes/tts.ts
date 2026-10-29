import type { FastifyInstance } from "fastify";
import { ValidationError } from "@magnexis/shared";

/**
 * High-quality navigation TTS proxy.
 * Prefer OpenAI TTS when OPENAI_API_KEY is set; else ElevenLabs when
 * ELEVENLABS_API_KEY is set. Keys never leave the server.
 */
export async function registerTtsRoutes(app: FastifyInstance) {
  app.get("/api/v1/tts/status", async () => {
    const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
    const eleven = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
    return {
      configured: openai || eleven,
      provider: openai ? "openai" : eleven ? "elevenlabs" : null,
    };
  });

  app.post("/api/v1/tts/speak", async (request, reply) => {
    const body = (request.body ?? {}) as { text?: string; voice?: string };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 500) {
      throw new ValidationError("Provide guidance text up to 500 characters.");
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();

    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          voice: body.voice?.trim() || "nova",
          input: text,
          response_format: "mp3",
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        app.log.warn({ status: res.status, detail }, "OpenAI TTS failed");
        throw new ValidationError("Cloud voice synthesis is temporarily unavailable.");
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return reply
        .header("Content-Type", "audio/mpeg")
        .header("Cache-Control", "no-store")
        .send(buf);
    }

    if (elevenKey) {
      const voiceId =
        process.env.ELEVENLABS_VOICE_ID?.trim() ||
        body.voice?.trim() ||
        "21m00Tcm4TlvDq8ikWAM"; // Rachel
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id:
              process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5",
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        app.log.warn({ status: res.status, detail }, "ElevenLabs TTS failed");
        throw new ValidationError("Cloud voice synthesis is temporarily unavailable.");
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return reply
        .header("Content-Type", "audio/mpeg")
        .header("Cache-Control", "no-store")
        .send(buf);
    }

    throw new ValidationError(
      "Cloud TTS is not configured. Set OPENAI_API_KEY or ELEVENLABS_API_KEY on the API.",
    );
  });
}
