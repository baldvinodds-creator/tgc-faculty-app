import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logAudit } from "../lib/audit.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const facultyId = url.searchParams.get("facultyId");
    const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0", 10);

    const where: Record<string, unknown> = {};

    if (status) {
      where.payoutStatus = status;
    }

    if (facultyId) {
      where.facultyId = facultyId;
    }

    const [payouts, total] = await Promise.all([
      prisma.payoutTracking.findMany({
        where,
        include: {
          faculty: {
            select: { id: true, fullName: true, publicName: true, email: true },
          },
        },
        orderBy: { periodStart: "desc" },
        take,
        skip,
      }),
      prisma.payoutTracking.count({ where }),
    ]);

    return json({ payouts, total, take, skip });
  } catch (error) {
    console.error("List payouts error:", error);
    return json({ error: "Failed to load payouts" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);

  try {
    const body = await request.json();

    const {
      facultyId,
      periodStart,
      periodEnd,
      grossRevenue,
      platformFees,
      teacherPayout,
      payoutMethod,
      payoutReference,
      notes,
    } = body;

    if (!facultyId || !periodStart || !periodEnd) {
      return json({ error: "facultyId, periodStart, and periodEnd are required" }, { status: 400 });
    }

    if (grossRevenue == null || platformFees == null || teacherPayout == null) {
      return json({ error: "grossRevenue, platformFees, and teacherPayout are required" }, { status: 400 });
    }

    // Verify faculty exists
    const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
    if (!faculty) {
      return json({ error: "Faculty not found" }, { status: 404 });
    }

    const payout = await prisma.payoutTracking.create({
      data: {
        facultyId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        grossRevenue,
        platformFees,
        teacherPayout,
        payoutStatus: "pending",
        payoutMethod: payoutMethod || null,
        payoutReference: payoutReference || null,
        notes: notes || null,
      },
    });

    await logAudit({
      actorType: "admin",
      actorId: session.id,
      action: "payout.created",
      objectType: "payout",
      objectId: payout.id,
      details: { facultyId, teacherPayout },
    });

    return json({ success: true, payout }, { status: 201 });
  } catch (error) {
    console.error("Create payout error:", error);
    const message = error instanceof Error ? error.message : "Failed to create payout";
    return json({ error: message }, { status: 500 });
  }
}
