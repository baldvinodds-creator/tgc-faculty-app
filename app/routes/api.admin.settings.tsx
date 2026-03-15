import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { logAudit } from "../lib/audit.server";
import * as fs from "fs/promises";
import * as path from "path";

// Simple file-based settings store. In production, move to a DB table or metafields.
const SETTINGS_PATH = path.resolve(process.cwd(), "data", "settings.json");

interface AppSettings {
  acceptingApplications: boolean;
  applicationNoticeMessage: string;
  autoApproveProfileEdits: boolean;
  defaultPayoutMethod: string;
  platformFeePercent: number;
  maintenanceMode: boolean;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  acceptingApplications: true,
  applicationNoticeMessage: "",
  autoApproveProfileEdits: false,
  defaultPayoutMethod: "manual",
  platformFeePercent: 20,
  maintenanceMode: false,
};

async function readSettings(): Promise<AppSettings> {
  try {
    const data = await fs.readFile(SETTINGS_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  const dir = path.dirname(SETTINGS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const settings = await readSettings();
    return json({ settings });
  } catch (error) {
    console.error("Read settings error:", error);
    return json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  try {
    const body = await request.json();
    const current = await readSettings();

    // Merge updates into current settings (only known keys)
    const updated: AppSettings = { ...current };

    const ALLOWED_KEYS = new Set([
      "acceptingApplications",
      "applicationNoticeMessage",
      "autoApproveProfileEdits",
      "defaultPayoutMethod",
      "platformFeePercent",
      "maintenanceMode",
    ]);

    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_KEYS.has(key)) {
        updated[key] = value;
        changedKeys.push(key);
      }
    }

    if (changedKeys.length === 0) {
      return json({ error: "No valid settings to update" }, { status: 400 });
    }

    await writeSettings(updated);

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "settings.updated",
      details: { changedKeys },
    });

    return json({ success: true, settings: updated });
  } catch (error) {
    console.error("Update settings error:", error);
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return json({ error: message }, { status: 500 });
  }
}
