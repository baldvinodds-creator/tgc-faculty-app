// Webhook: APP_INSTALLED
// Runs setup tasks when the app is first installed on a shop
// - Creates the tgc_faculty metaobject definition

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectDefinition } from "../lib/setup.server";
import { logAudit } from "../lib/audit.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop } = await authenticate.webhook(request);

  console.log(`[webhook] App installed on ${shop}`);

  if (!admin) {
    console.error("[webhook] No admin API context available in install webhook");
    return new Response("OK", { status: 200 });
  }

  try {
    const result = await ensureMetaobjectDefinition(admin);

    await logAudit({
      actorType: "system",
      action: "webhook.app_installed",
      details: {
        shop,
        metaobjectDefinition: result,
      },
    });

    console.log("[webhook] Setup complete:", result);
  } catch (error) {
    console.error("[webhook] Setup failed:", error);

    await logAudit({
      actorType: "system",
      action: "webhook.app_installed_error",
      details: {
        shop,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return new Response("OK", { status: 200 });
};
