// PUT /me/devices.
import { RegisterDeviceRequestSchema } from "@app/contracts";
import type { AppDeps, AppHono } from "../../context";
import { AppError } from "../../errors";
import { parseJsonBody } from "../../lib/validate";
import { registerDevice } from "./devices";

export function registerNotificationRoutes(app: AppHono, deps: AppDeps): void {
  app.put("/me/devices", async (c) => {
    const auth = c.get("auth");
    if (!auth) throw new AppError("UNAUTHENTICATED", "Authentification requise");
    const body = await parseJsonBody(c, RegisterDeviceRequestSchema);
    await registerDevice(deps.db, auth.userId, auth.sessionId, body.apnsToken, body.environment);
    return c.body(null, 204);
  });
}
