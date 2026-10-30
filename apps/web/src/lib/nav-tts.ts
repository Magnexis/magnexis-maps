/**
 * Fetch high-quality navigation speech from the Magnexis API when configured
 * (OpenAI TTS or ElevenLabs). Returns null when cloud TTS is unavailable.
 */
import { resolveApiBase } from "./api-base";

function apiBase(): string {
  return resolveApiBase();
}

let statusCache: { configured: boolean; at: number } | null = null;

export async function cloudTtsConfigured(): Promise<boolean> {
  const now = Date.now();
  if (statusCache && now - statusCache.at < 60_000) {
    return statusCache.configured;
  }
  try {
    const res = await fetch(`${apiBase()}/api/v1/tts/status`);
    if (!res.ok) {
      statusCache = { configured: false, at: now };
      return false;
    }
    const data = (await res.json()) as { configured?: boolean };
    statusCache = { configured: Boolean(data.configured), at: now };
    return statusCache.configured;
  } catch {
    statusCache = { configured: false, at: now };
    return false;
  }
}

export async function fetchCloudTtsAudio(
  text: string,
): Promise<ArrayBuffer | null> {
  if (!(await cloudTtsConfigured())) return null;
  try {
    const res = await fetch(`${apiBase()}/api/v1/tts/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
