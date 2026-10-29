import {
  createHostedApp,
  serveRequest,
} from "../../services/api/dist/serverless.js";

let application;

export default async function handler(request, context) {
  try {
    application ??= createHostedApp().catch((error) => {
      application = undefined;
      throw error;
    });
    return await serveRequest(await application, request, context.ip);
  } catch {
    // Never expose connection strings, provider keys or database diagnostics.
    return Response.json(
      {
        error: "The Maps service is temporarily unavailable. Please try again.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const config = { path: "/api/v1/*" };
