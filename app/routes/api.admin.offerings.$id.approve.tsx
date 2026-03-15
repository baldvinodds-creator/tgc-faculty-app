import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { approveOffering } from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Offering ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const publishImmediately = body.publishImmediately !== false; // default true

    const reviewerId = session.id;
    const result = await approveOffering(id, reviewerId, admin, publishImmediately);

    return json({ success: true, provisioning: result });
  } catch (error) {
    console.error("Approve offering error:", error);
    const message = error instanceof Error ? error.message : "Failed to approve offering";
    return json({ error: message }, { status: 500 });
  }
}
