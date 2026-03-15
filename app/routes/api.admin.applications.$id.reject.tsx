import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { rejectApplication } from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Application ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { notes } = body;

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return json({ error: "Rejection notes are required" }, { status: 400 });
    }

    const reviewerId = session.id;
    await rejectApplication(id, reviewerId, notes.trim());

    return json({ success: true });
  } catch (error) {
    console.error("Reject application error:", error);
    const message = error instanceof Error ? error.message : "Failed to reject application";
    return json({ error: message }, { status: 500 });
  }
}
