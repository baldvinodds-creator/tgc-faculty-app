// POST /api/internal/discovery
// Bulk-imports existing teachers from CSV data into the database
// Creates Faculty, FacultyApplication, SyncShopify, Offering, and Consent records
// Idempotent: uses upsert on Faculty (email as unique key)

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { logAudit } from "../lib/audit.server";

interface CSVTeacher {
  // Mapped from CSV columns
  firstName?: string;       // col 4
  lastName?: string;        // col 5
  email: string;            // col 6
  phone?: string;           // col 7
  country?: string;         // col 8
  city?: string;            // col 9
  primaryInstrument?: string; // col 10
  teachingLanguages?: string; // col 11 — comma-separated string
  websiteUrl?: string;      // col 12
  credentials?: string;     // col 13
  institutions?: string;    // col 14
  yearsExperience?: number; // col 15
  headshotUrl?: string;     // col 16
  shortBio?: string;        // derived
  longBio?: string;         // derived
  specialties?: string;     // col 8 styles/genres — comma-separated
  division?: string;        // derived from instrument
  socialInstagram?: string;
  socialYoutube?: string;
  socialLinkedin?: string;
  publicName?: string;      // display name override

  // Shopify IDs from CSV
  collectionId?: string;          // col 115 — Shopify collection GID
  privateProductId?: string;      // col 105 — Shopify product GID
  masterclassProductId?: string;  // col 106
  groupLessonProductId?: string;  // col 107

  // Prices (if available)
  privateLessonPrice?: number;
  masterclassPrice?: number;
  groupLessonPrice?: number;

  // Full raw row for archival
  rawRow?: Record<string, unknown>;
}

// Instrument → Division mapping
const DIVISION_MAP: Record<string, string> = {
  voice: "Voice", vocals: "Voice", soprano: "Voice", mezzo: "Voice", tenor: "Voice", baritone: "Voice",
  piano: "Piano", keyboard: "Piano",
  bass: "Strings", violin: "Strings", viola: "Strings", cello: "Strings", "double bass": "Strings", harp: "Strings", guitar: "Strings",
  flute: "Winds", oboe: "Winds", clarinet: "Winds", bassoon: "Winds", saxophone: "Winds", recorder: "Winds",
  trumpet: "Brass", "french horn": "Brass", horn: "Brass", trombone: "Brass", tuba: "Brass",
  percussion: "Percussion", drums: "Percussion", timpani: "Percussion", marimba: "Percussion",
  composition: "Composition",
  theory: "Theory", "music theory": "Theory", "ear training": "Theory",
  conducting: "Conducting",
};

function inferDivision(instrument: string | undefined): string | undefined {
  if (!instrument) return undefined;
  const lower = instrument.toLowerCase().trim();
  return DIVISION_MAP[lower] || "Other";
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Authenticate as admin (internal route)
  const { admin } = await authenticate.admin(request);
  void admin; // used for auth check only

  const body = await request.json();
  const teachers: CSVTeacher[] = body.teachers;

  if (!Array.isArray(teachers) || teachers.length === 0) {
    return json({ error: "teachers array required" }, { status: 400 });
  }

  const results = {
    created: 0,
    updated: 0,
    linked: 0,
    offeringsCreated: 0,
    errors: [] as Array<{ email: string; error: string }>,
  };

  for (const teacher of teachers) {
    try {
      if (!teacher.email) {
        results.errors.push({ email: "unknown", error: "Missing email" });
        continue;
      }

      const email = teacher.email.trim().toLowerCase();
      const fullName = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") || null;
      const publicName = teacher.publicName || fullName;
      const division = teacher.division || inferDivision(teacher.primaryInstrument);
      const teachingLanguages = teacher.teachingLanguages
        ? teacher.teachingLanguages.split(",").map((l) => l.trim()).filter(Boolean)
        : [];
      const specialties = teacher.specialties
        ? teacher.specialties.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      // Upsert faculty record
      const existing = await prisma.faculty.findUnique({ where: { email } });

      const facultyData = {
        email,
        role: "teacher" as const,
        status: "active",
        fullName,
        publicName,
        phone: teacher.phone || null,
        country: teacher.country || null,
        city: teacher.city || null,
        primaryInstrument: teacher.primaryInstrument || null,
        division: division || null,
        teachingLanguages,
        specialties,
        shortBio: teacher.shortBio || null,
        longBio: teacher.longBio || null,
        credentials: teacher.credentials || null,
        institutions: teacher.institutions || null,
        yearsExperience: teacher.yearsExperience || null,
        headshotUrl: teacher.headshotUrl || null,
        websiteUrl: teacher.websiteUrl || null,
        socialInstagram: teacher.socialInstagram || null,
        socialYoutube: teacher.socialYoutube || null,
        socialLinkedin: teacher.socialLinkedin || null,
        profilePublished: true,
        onboardingComplete: true,
        profileCompleteness: calculateCompleteness({
          fullName, publicName, shortBio: teacher.shortBio,
          primaryInstrument: teacher.primaryInstrument,
          headshotUrl: teacher.headshotUrl,
          credentials: teacher.credentials,
          teachingLanguages, specialties,
        }),
      };

      const faculty = await prisma.faculty.upsert({
        where: { email },
        create: facultyData,
        update: {
          ...facultyData,
          // Don't overwrite these if already set
          status: existing?.status === "suspended" ? "suspended" : "active",
        },
      });

      if (existing) {
        results.updated++;
      } else {
        results.created++;
      }

      // Create FacultyApplication record (archive the raw CSV data)
      await prisma.facultyApplication.upsert({
        where: { facultyId: faculty.id },
        create: {
          facultyId: faculty.id,
          applicationData: teacher.rawRow || teacher,
          status: "approved",
          reviewedAt: new Date(),
          reviewNotes: "Imported from existing faculty CSV",
        },
        update: {
          applicationData: teacher.rawRow || teacher,
        },
      });

      // ─── Shopify Sync Records ───

      // Collection
      if (teacher.collectionId) {
        await prisma.syncShopify.upsert({
          where: {
            id: (await prisma.syncShopify.findFirst({
              where: { objectId: faculty.id, objectType: "faculty_collection" },
              select: { id: true },
            }))?.id || "none",
          },
          create: {
            objectType: "faculty_collection",
            objectId: faculty.id,
            shopifyObjectType: "collection",
            shopifyObjectId: normalizeGID("Collection", teacher.collectionId),
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          },
          update: {
            shopifyObjectId: normalizeGID("Collection", teacher.collectionId),
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          },
        });
        results.linked++;
      }

      // Private Lesson Product
      if (teacher.privateProductId) {
        const offeringId = await ensureOffering(faculty.id, "private_lesson", teacher.privateLessonPrice || 0);
        await linkProduct(offeringId, teacher.privateProductId, "Product");
        results.linked++;
        results.offeringsCreated++;
      }

      // Masterclass Product
      if (teacher.masterclassProductId) {
        const offeringId = await ensureOffering(faculty.id, "masterclass", teacher.masterclassPrice || 0);
        await linkProduct(offeringId, teacher.masterclassProductId, "Product");
        results.linked++;
        results.offeringsCreated++;
      }

      // Group Lesson Product
      if (teacher.groupLessonProductId) {
        const offeringId = await ensureOffering(faculty.id, "group_class", teacher.groupLessonPrice || 0);
        await linkProduct(offeringId, teacher.groupLessonProductId, "Product");
        results.linked++;
        results.offeringsCreated++;
      }

      // Consent records (they agreed as existing faculty)
      const consentTypes = [
        "terms_of_service",
        "privacy_policy",
        "cancellation_policy",
        "conduct_policy",
        "payout_agreement",
      ];

      for (const consentType of consentTypes) {
        const existingConsent = await prisma.consent.findFirst({
          where: { facultyId: faculty.id, consentType },
        });

        if (!existingConsent) {
          await prisma.consent.create({
            data: {
              facultyId: faculty.id,
              consentType,
              version: "1.0-import",
              acceptedAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push({
        email: teacher.email || "unknown",
        error: errorMessage,
      });
    }
  }

  await logAudit({
    actorType: "system",
    action: "discovery.bulk_import",
    details: {
      totalTeachers: teachers.length,
      created: results.created,
      updated: results.updated,
      linked: results.linked,
      offeringsCreated: results.offeringsCreated,
      errorCount: results.errors.length,
    },
  });

  return json(results);
}

// ─── Helpers ───

function normalizeGID(type: string, id: string): string {
  if (id.startsWith("gid://")) return id;
  // If it's just a number, build the GID
  return `gid://shopify/${type}/${id}`;
}

async function ensureOffering(
  facultyId: string,
  offeringType: string,
  price: number,
): Promise<string> {
  // Check if offering of this type already exists for this faculty
  const existing = await prisma.offering.findFirst({
    where: { facultyId, offeringType },
  });

  if (existing) return existing.id;

  const typeLabels: Record<string, string> = {
    private_lesson: "Private Lesson",
    masterclass: "Masterclass",
    group_class: "Group Class",
  };

  const offering = await prisma.offering.create({
    data: {
      facultyId,
      offeringType,
      status: "live",
      title: typeLabels[offeringType] || offeringType,
      price,
      format: "online",
      durationMinutes: offeringType === "masterclass" ? 90 : 60,
      approvedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  return offering.id;
}

async function linkProduct(
  offeringId: string,
  shopifyProductId: string,
  type: string,
): Promise<void> {
  const existingSync = await prisma.syncShopify.findFirst({
    where: { objectId: offeringId, objectType: "offering_product" },
  });

  if (existingSync) {
    await prisma.syncShopify.update({
      where: { id: existingSync.id },
      data: {
        shopifyObjectId: normalizeGID(type, shopifyProductId),
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });
  } else {
    await prisma.syncShopify.create({
      data: {
        objectType: "offering_product",
        objectId: offeringId,
        shopifyObjectType: "product",
        shopifyObjectId: normalizeGID(type, shopifyProductId),
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });
  }
}

function calculateCompleteness(data: {
  fullName?: string | null;
  publicName?: string | null;
  shortBio?: string | null;
  primaryInstrument?: string | null;
  headshotUrl?: string | null;
  credentials?: string | null;
  teachingLanguages?: string[];
  specialties?: string[];
}): number {
  const fields = [
    !!data.fullName,
    !!data.publicName,
    !!data.shortBio,
    !!data.primaryInstrument,
    !!data.headshotUrl,
    !!data.credentials,
    data.teachingLanguages && data.teachingLanguages.length > 0,
    data.specialties && data.specialties.length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}
