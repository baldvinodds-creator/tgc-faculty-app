import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set — emails will be logged but not sent");
      return null;
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/** Send an email via Resend, or log it if RESEND_API_KEY is not configured */
async function sendEmail(params: { from: string; to: string; subject: string; html: string }) {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED] To: ${params.to} | Subject: ${params.subject}`);
    return;
  }
  await resend.emails.send(params);
}

// Use env var for FROM_EMAIL so we can switch between verified domains
// Once theglobalconservatory.com is verified in Resend, update the env var
const FROM_EMAIL = process.env.FROM_EMAIL || "TGC Faculty <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "meetupreykjavik@gmail.com";
const APP_URL = process.env.SHOPIFY_APP_URL || "https://tgc-faculty-app.railway.app";
const PORTAL_URL = "https://theglobalconservatory.com/apps/faculty";

// ─── Magic Link ───

export async function sendMagicLinkEmail(email: string, token: string, isNew: boolean) {
  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;

  const subject = isNew
    ? "Start Your Application — The Global Conservatory"
    : "Log in to The Global Conservatory Faculty Portal";

  const body = isNew
    ? `
      <h2>Welcome to The Global Conservatory</h2>
      <p>Click the link below to start your faculty application:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">Start Application</a></p>
      <p style="color:#666;font-size:13px;">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    `
    : `
      <h2>Log In to Your Faculty Portal</h2>
      <p>Click the link below to access your faculty dashboard:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">Log In</a></p>
      <p style="color:#666;font-size:13px;">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    `;

  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject,
    html: body,
  });
}

// ─── Application Received ───

export async function sendApplicationReceivedEmail(email: string, name: string) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Application Received — The Global Conservatory",
    html: `
      <h2>Thank You, ${name}!</h2>
      <p>We've received your faculty application. Our team will review it and get back to you soon.</p>
      <p>You'll receive an email once a decision has been made.</p>
    `,
  });
}

// ─── Application Approved ───

export async function sendApplicationApprovedEmail(email: string, name: string) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Welcome to The Global Conservatory Faculty!",
    html: `
      <h2>Congratulations, ${name}!</h2>
      <p>Your application to The Global Conservatory faculty has been approved!</p>
      <p>Log in to your Faculty Portal to complete your profile and create your first offering:</p>
      <p><a href="${PORTAL_URL}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">Go to Faculty Portal</a></p>
    `,
  });
}

// ─── Application Rejected ───

export async function sendApplicationRejectedEmail(email: string, name: string, notes?: string) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Application Update — The Global Conservatory",
    html: `
      <h2>Application Update</h2>
      <p>Dear ${name},</p>
      <p>Thank you for your interest in The Global Conservatory. After careful review, we are unable to accept your application at this time.</p>
      ${notes ? `<p><strong>Feedback:</strong> ${notes}</p>` : ""}
      <p>You are welcome to reapply in the future.</p>
    `,
  });
}

// ─── Changes Requested ───

export async function sendChangesRequestedEmail(
  email: string,
  name: string,
  objectType: string,
  notes: string,
) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Action Needed — The Global Conservatory",
    html: `
      <h2>Changes Requested</h2>
      <p>Hi ${name},</p>
      <p>Our team has reviewed your ${objectType} and would like some changes:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${notes}</blockquote>
      <p>Please log in to your Faculty Portal to make the requested changes:</p>
      <p><a href="${PORTAL_URL}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">Go to Faculty Portal</a></p>
    `,
  });
}

// ─── Offering Approved ───

export async function sendOfferingApprovedEmail(email: string, name: string, offeringTitle: string) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Offering Is Live! — The Global Conservatory",
    html: `
      <h2>Your Offering Is Live!</h2>
      <p>Hi ${name},</p>
      <p>Great news — your offering "<strong>${offeringTitle}</strong>" has been approved and is now live on the storefront.</p>
      <p><a href="${PORTAL_URL}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:6px;">View in Portal</a></p>
    `,
  });
}

// ─── Profile Update Approved ───

export async function sendProfileUpdateApprovedEmail(email: string, name: string) {
  await sendEmail({
    from: FROM_EMAIL,
    to: email,
    subject: "Profile Updated — The Global Conservatory",
    html: `
      <h2>Profile Updated</h2>
      <p>Hi ${name},</p>
      <p>Your profile changes have been approved and are now live on the storefront.</p>
    `,
  });
}

// ─── Admin Notification ───

export async function sendAdminNotification(
  type: "application" | "offering" | "profile_edit" | "offering_edit" | "contact",
  details: { teacherName: string; teacherEmail: string; subject?: string; message?: string },
) {
  const typeLabels: Record<string, string> = {
    application: "New Application",
    offering: "New Offering",
    profile_edit: "Profile Edit Request",
    offering_edit: "Offering Edit Request",
    contact: "Teacher Message",
  };

  const body = type === "contact"
    ? `
      <h2>${typeLabels[type]} Submitted</h2>
      <p><strong>From:</strong> ${details.teacherName} (${details.teacherEmail})</p>
      <p><strong>Subject:</strong> ${details.subject || "No subject"}</p>
      <p>${details.message || ""}</p>
    `
    : `
      <h2>${typeLabels[type]} Submitted</h2>
      <p><strong>Teacher:</strong> ${details.teacherName} (${details.teacherEmail})</p>
      <p>Log in to the Shopify Admin → TGC Faculty app to review.</p>
    `;

  await sendEmail({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `${typeLabels[type]} — TGC Faculty App`,
    html: body,
  });
}
