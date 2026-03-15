import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status");
    const division = url.searchParams.get("division");
    const instrument = url.searchParams.get("instrument");
    const take = Math.min(parseInt(url.searchParams.get("take") || "50", 10), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0", 10);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { publicName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (division) {
      where.division = division;
    }

    if (instrument) {
      where.primaryInstrument = { contains: instrument, mode: "insensitive" };
    }

    const [facultyList, total] = await Promise.all([
      prisma.faculty.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          publicName: true,
          status: true,
          division: true,
          primaryInstrument: true,
          profilePublished: true,
          profileCompleteness: true,
          acceptingStudents: true,
          featured: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              offerings: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.faculty.count({ where }),
    ]);

    // Attach latest sync status for each faculty
    const facultyIds = facultyList.map((f) => f.id);
    const syncRecords = facultyIds.length > 0
      ? await prisma.syncShopify.findMany({
          where: { objectId: { in: facultyIds } },
          select: { syncStatus: true, objectType: true, lastSyncedAt: true, objectId: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    const syncMap = new Map<string, typeof syncRecords>();
    for (const s of syncRecords) {
      if (!syncMap.has(s.objectId)) {
        syncMap.set(s.objectId, []);
      }
      syncMap.get(s.objectId)!.push(s);
    }

    const faculty = facultyList.map((f) => ({
      ...f,
      syncShopify: (syncMap.get(f.id) || []).slice(0, 1),
    }));

    return json({ faculty, total, take, skip });
  } catch (error) {
    console.error("List faculty error:", error);
    return json({ error: "Failed to load faculty" }, { status: 500 });
  }
}
