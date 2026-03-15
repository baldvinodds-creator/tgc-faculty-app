import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { rejectOffering } from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Offering ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { notes } = body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return json({ error: "Rejection notes are required" }, { status: 400 });
    }

    const reviewerId = session.id;
    await rejectOffering(id, reviewerId, notes.trim());

    return json({ success: true });
  } catch (error) {
    console.error("Reject offering error:", error);
    const message = error instanceof Error ? error.message : "Failed to reject offering";
    return json({ error: message }, { status: 500 });
  }
}
