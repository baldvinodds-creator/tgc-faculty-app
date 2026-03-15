import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { approveApplication } from "../lib/workflows.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Application ID is required" }, { status: 400 });
  }

  try {
    const reviewerId = session.id;
    const result = await approveApplication(id, reviewerId, admin);

    return json({ success: true, provisioning: result });
  } catch (error) {
    console.error("Approve application error:", error);
    const message = error instanceof Error ? error.message : "Failed to approve application";
    return json({ error: message }, { status: 500 });
  }
}
