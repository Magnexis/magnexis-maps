import type { FastifyInstance } from "fastify";
import { DeleteAccountSchema, ValidationError } from "@magnexis/shared";
import { requireAuth } from "../plugins/auth.js";
import { deleteAccount } from "../services/delete-account.js";

export async function registerAccountDeletionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.delete(
    "/api/v1/me",
    { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request) => {
      const user = requireAuth(request);
      const body = DeleteAccountSchema.safeParse(request.body);
      if (!body.success)
        throw new ValidationError(
          "Type DELETE to confirm account deletion. Password accounts must also send the current password.",
        );
      await deleteAccount(app.db, user.id, body.data.password);
      return { deleted: true as const };
    },
  );
}
