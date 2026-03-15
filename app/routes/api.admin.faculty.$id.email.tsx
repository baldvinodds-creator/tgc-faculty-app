import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
const FROM_EMAIL = "TGC Faculty <faculty@theglobalconservatory.com>";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  const { id } = params;
  if (!id) {
    return json({ error: "Faculty ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { subject, message } = body;

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return json({ error: "Email subject is required" }, { status: 400 });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return json({ error: "Email message is required" }, { status: 400 });
    }

    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    const name = faculty.publicName || faculty.fullName || "Teacher";

    await getResend().emails.send({
      from: FROM_EMAIL,
      to: faculty.email,
      subject: subject.trim(),
      html: `
        <p>Hi ${name},</p>
        ${message.trim().split("\n").map((line: string) => `<p>${line}</p>`).join("")}
        <br>
        <p style="color:#666;font-size:13px;">— The Global Conservatory Team</p>
      `,
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "faculty.email_sent",
      objectType: "faculty",
      objectId: id,
      details: { subject: subject.trim() },
    });

    return json({ success: true });
  } catch (error) {
    console.error("Send email error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return json({ error: message }, { status: 500 });
  }
}
