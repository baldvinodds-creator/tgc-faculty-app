/**
 * Import existing faculty applications from the Google Form CSV export.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/import-csv.ts ../faculty-applications.csv
 *
 * - Creates Faculty records with status "approved" for accepted teachers
 * - Creates FacultyApplication records with full applicationData JSON
 * - Creates FacultyTech records from tech-setup columns
 * - Creates AvailabilityPreferences from availability grid
 * - Creates Consent records for each consent checkbox
 * - Creates SyncShopify records linking existing Shopify Product/Collection IDs
 * - Creates AuditLog entries for each import
 * - Idempotent: uses upsert on email, safe to re-run
 */

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// ─── Column indices (from CSV header analysis) ───

const COL = {
  timestamp: 1,
  email: 2,
  invitedBy: 3,
  fullName: 4,
  lastName: 5,
  emailAlt: 6,
  phone: 7,
  timezone: 8,
  countryCity: 9,
  primaryInstrument: 10,
  languages: 11,
  links: 12,
  yearsExperience: 13,
  currentRoles: 14,
  qualification: 15,
  headshot: 16,
  portfolio: 17,
  levels: 18,
  teachingStyle: 19,
  ageGroups: 20,
  whyJoin: 21,
  lessonType: 22,
  inPersonCities: 23,
  openToGroup: 24,
  zoomFamiliarity: 25,
  wifiReliable: 26,
  microphoneType: 27,
  dedicatedCamera: 28,
  techSetupDesc: 29,
  backupPlan: 30,
  usesAiTools: 31,
  aiToolsExplanation: 32,
  hourlyRate: 33,
  availMon: 34,
  availTue: 35,
  availWed: 36,
  availThu: 37,
  availFri: 38,
  availSat: 39,
  availSun: 40,
  additionalTimes: 41,
  canRecord: 42,
  willingVideoIntro: 43,
  accessibilityOk: 44,
  consentPlatformFee: 45,
  consentPaypal: 46,
  consentTaxReporting: 47,
  consentNoSolicitation: 48,
  consentNoRecording: 49,
  consentInPersonLiability: 50,
  consentConduct: 51,
  consentPolicies: 52,
  referredBy: 53,
  inviteColleagues: 54,
  removedFromPlatform: 55,
  removedExplanation: 56,
  disciplinaryIssues: 57,
  disciplinaryExplanation: 58,
  diversityStatement: 59,
  contactMethod: 60,
  stylesGenres: 61,
  studentAgeRange: 62,
  awards: 63,
  cvLinks: 64,
  shortBio: 65,
  zoomLink: 66,
  classTypes: 67,
  durations: 68,
  weeklySlots: 69,
  masterclassTopics: 70,
  masterclassLength: 71,
  performerSeats: 72,
  observerCapacity: 73,
  recordingOkTickets: 74,
  preferredTerm: 75,
  weeklyTimeCommitment: 76,
  targetCohortSize: 77,
  syllabus: 78,
  groupTopics: 79,
  groupFormat: 80,
  targetClassSize: 81,
  baseRate60: 82,
  // col 83 = "Sophia" (orphan)
  otherAvailability: 84,
  consentICA: 85,
  consentNoOffPlatform: 86,
  consentProfilePricing: 87,
  consentRefundsCancellations: 88,
  // 89-94 = secondary availability set (rarely filled)
  timezone2: 95,
  // col 96 = dupe
  consentProfilePricing2: 97,
  // col 98-99 = orphan
  status: 100,
  // 101-104 = processing metadata
  privateProductId: 105,
  masterclassProductId: 106,
  groupProductId: 107,
  privateProductUrl: 108,
  masterclassProductUrl: 109,
  groupProductUrl: 110,
  // 111-114 = error/warning/workflow metadata
  collectionId: 115,
  collectionUrl: 116,
  uniqueId: 117,
};

// ─── Helpers ───

function s(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function splitCommaList(val: string): string[] {
  return val
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseYearsExperience(val: string): number | null {
  // The field often contains text like "20 years" or full sentences
  const match = val.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parsePrice(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseCountryFromCityString(val: string): string | null {
  // Format: "City, Country" or "City/State/Country"
  if (!val) return null;
  const parts = val.split(/[,/]/).map((x) => x.trim());
  return parts[parts.length - 1] || null;
}

function parseCityFromCityString(val: string): string | null {
  if (!val) return null;
  const parts = val.split(/[,/]/).map((x) => x.trim());
  return parts[0] || null;
}

function buildAvailabilityGrid(row: string[]): Record<string, string[]> {
  const days: Record<string, number> = {
    monday: COL.availMon,
    tuesday: COL.availTue,
    wednesday: COL.availWed,
    thursday: COL.availThu,
    friday: COL.availFri,
    saturday: COL.availSat,
    sunday: COL.availSun,
  };
  const grid: Record<string, string[]> = {};
  for (const [day, col] of Object.entries(days)) {
    const val = s(row, col);
    if (val) {
      grid[day] = val.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return grid;
}

function inferDivision(instrument: string): string | null {
  const lower = instrument.toLowerCase();
  if (/piano|keyboard|harpsichord/.test(lower)) return "Piano";
  if (/voice|vocal|sing/.test(lower)) return "Voice";
  if (/violin|viola|cello|bass(?!oon)/.test(lower)) return "Strings";
  if (/flute|oboe|clarinet|bassoon|piccolo|saxophone/.test(lower)) return "Winds";
  if (/trumpet|trombone|horn|tuba|brass/.test(lower)) return "Brass";
  if (/percussion|drum|timpani/.test(lower)) return "Percussion";
  if (/compos|theory|orchestrat|harmony|counterpoint/.test(lower)) return "Composition";
  if (/conduct/.test(lower)) return "Conducting";
  if (/guitar|uke|oud/.test(lower)) return "Other";
  return "Other";
}

// ─── Main Import ───

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import-csv.ts <path-to-csv>");
    process.exit(1);
  }

  const absolutePath = path.resolve(csvPath);
  console.log(`Reading CSV from: ${absolutePath}`);

  const raw = fs.readFileSync(absolutePath, "utf-8");
  const rows: string[][] = parse(raw, {
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const headers = rows.shift()!;
  console.log(`Parsed ${rows.length} rows (${headers.length} columns)`);

  const accepted = rows.filter((r) => s(r, COL.status) === "Accepted");
  console.log(`Found ${accepted.length} accepted applications to import\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of accepted) {
    const email = s(row, COL.email).toLowerCase();
    const fullName = s(row, COL.fullName);
    const primaryInstrument = s(row, COL.primaryInstrument);

    if (!email || !fullName) {
      console.warn(`  SKIP: missing email or name — row email=${email}, name=${fullName}`);
      errors++;
      continue;
    }

    // Skip obvious test entries
    const SKIP_EMAILS = ["theglobalacademy12@gmail.com", "lubidog@gmail.com"];
    const isTestEntry =
      SKIP_EMAILS.includes(email) ||
      (fullName.toLowerCase() === "test") ||
      (fullName.length < 3 && !s(row, COL.shortBio)) ||
      (primaryInstrument.toLowerCase() === "test") ||
      (primaryInstrument.includes("@"));

    if (isTestEntry) {
      console.warn(`  SKIP: test/junk entry — ${fullName} <${email}>`);
      errors++;
      continue;
    }

    try {
      const countryCity = s(row, COL.countryCity);
      const country = parseCountryFromCityString(countryCity);
      const city = parseCityFromCityString(countryCity);
      const shortBio = s(row, COL.shortBio);
      const languages = splitCommaList(s(row, COL.languages));
      const yearsExp = parseYearsExperience(s(row, COL.yearsExperience));
      const division = inferDivision(primaryInstrument);
      const stylesGenres = splitCommaList(s(row, COL.stylesGenres));
      const hourlyRate = parsePrice(s(row, COL.hourlyRate)) ?? parsePrice(s(row, COL.baseRate60));

      // Build the full applicationData blob (mirrors what the web form sends)
      const applicationData: Record<string, unknown> = {
        // Section 1: Identity
        fullName,
        lastName: s(row, COL.lastName),
        email,
        phone: s(row, COL.phone),
        country,
        city,
        timezone: s(row, COL.timezone) || s(row, COL.timezone2),
        contactMethod: s(row, COL.contactMethod),

        // Section 2: Teaching Profile
        primaryInstrument,
        stylesGenres: s(row, COL.stylesGenres),
        levels: s(row, COL.levels),
        ageGroups: s(row, COL.ageGroups),
        studentAgeRange: s(row, COL.studentAgeRange),
        teachingStyle: s(row, COL.teachingStyle),
        yearsExperience: s(row, COL.yearsExperience),
        currentRoles: s(row, COL.currentRoles),
        languages: s(row, COL.languages),
        lessonType: s(row, COL.lessonType),
        inPersonCities: s(row, COL.inPersonCities),

        // Section 3: Credentials
        qualification: s(row, COL.qualification),
        awards: s(row, COL.awards),
        cvLinks: s(row, COL.cvLinks),
        links: s(row, COL.links),

        // Section 4: Bio & Media
        shortBio,
        headshotUrl: s(row, COL.headshot),
        portfolio: s(row, COL.portfolio),

        // Section 5: What You Offer
        classTypes: s(row, COL.classTypes),
        durations: s(row, COL.durations),
        weeklySlots: s(row, COL.weeklySlots),
        openToGroup: s(row, COL.openToGroup),

        // 5.1 Masterclass
        masterclassTopics: s(row, COL.masterclassTopics),
        masterclassLength: s(row, COL.masterclassLength),
        performerSeats: s(row, COL.performerSeats),
        observerCapacity: s(row, COL.observerCapacity),
        recordingOkTickets: s(row, COL.recordingOkTickets),

        // 5.3 Group Lessons
        groupTopics: s(row, COL.groupTopics),
        groupFormat: s(row, COL.groupFormat),
        targetClassSize: s(row, COL.targetClassSize),
        preferredTerm: s(row, COL.preferredTerm),
        weeklyTimeCommitment: s(row, COL.weeklyTimeCommitment),
        targetCohortSize: s(row, COL.targetCohortSize),
        syllabus: s(row, COL.syllabus),

        // Section 6: Pricing
        hourlyRate: s(row, COL.hourlyRate),
        baseRate60: s(row, COL.baseRate60),

        // Section 7: Availability
        availability: buildAvailabilityGrid(row),
        additionalTimes: s(row, COL.additionalTimes),
        otherAvailability: s(row, COL.otherAvailability),

        // Section 8: Technical Setup
        zoomFamiliarity: s(row, COL.zoomFamiliarity),
        wifiReliable: s(row, COL.wifiReliable),
        microphoneType: s(row, COL.microphoneType),
        dedicatedCamera: s(row, COL.dedicatedCamera),
        techSetupDescription: s(row, COL.techSetupDesc),
        backupPlan: s(row, COL.backupPlan),
        usesAiTools: s(row, COL.usesAiTools),
        aiToolsExplanation: s(row, COL.aiToolsExplanation),
        zoomLink: s(row, COL.zoomLink),

        // Section 9: Policies & Consent
        consentPlatformFee: s(row, COL.consentPlatformFee),
        consentPaypal: s(row, COL.consentPaypal),
        consentTaxReporting: s(row, COL.consentTaxReporting),
        consentNoSolicitation: s(row, COL.consentNoSolicitation),
        consentNoRecording: s(row, COL.consentNoRecording),
        consentInPersonLiability: s(row, COL.consentInPersonLiability),
        consentConduct: s(row, COL.consentConduct),
        consentPolicies: s(row, COL.consentPolicies),
        consentICA: s(row, COL.consentICA),
        consentNoOffPlatform: s(row, COL.consentNoOffPlatform),
        consentProfilePricing: s(row, COL.consentProfilePricing),
        consentRefundsCancellations: s(row, COL.consentRefundsCancellations),

        // Section 10: Final Disclosures
        whyJoin: s(row, COL.whyJoin),
        canRecord: s(row, COL.canRecord),
        willingVideoIntro: s(row, COL.willingVideoIntro),
        accessibilityOk: s(row, COL.accessibilityOk),
        removedFromPlatform: s(row, COL.removedFromPlatform),
        removedExplanation: s(row, COL.removedExplanation),
        disciplinaryIssues: s(row, COL.disciplinaryIssues),
        disciplinaryExplanation: s(row, COL.disciplinaryExplanation),
        diversityStatement: s(row, COL.diversityStatement),
        invitedBy: s(row, COL.invitedBy),
        referredBy: s(row, COL.referredBy),
        inviteColleagues: s(row, COL.inviteColleagues),

        // Import metadata
        _importedFrom: "google-form-csv",
        _importedAt: new Date().toISOString(),
        _csvTimestamp: s(row, COL.timestamp),
      };

      // ─── Upsert Faculty ───
      const existing = await prisma.faculty.findUnique({ where: { email } });

      const facultyData = {
        fullName,
        publicName: fullName,
        phone: s(row, COL.phone) || null,
        country,
        city,
        timezone: s(row, COL.timezone) || s(row, COL.timezone2) || null,
        teachingLanguages: languages,
        shortBio: shortBio || null,
        credentials: s(row, COL.qualification) || null,
        institutions: s(row, COL.currentRoles) || null,
        awards: s(row, COL.awards) || null,
        specialties: stylesGenres,
        primaryInstrument: primaryInstrument || null,
        division,
        yearsExperience: yearsExp,
        headshotUrl: s(row, COL.headshot) || null,
        websiteUrl: s(row, COL.links) || null,
        zoomLink: s(row, COL.zoomLink) || null,
      };

      const faculty = await prisma.faculty.upsert({
        where: { email },
        create: {
          email,
          status: "approved",
          ...facultyData,
        },
        update: {
          // Only update if status is still applicant (don't overwrite active teachers)
          ...(existing?.status === "applicant" ? { status: "approved", ...facultyData } : {}),
        },
      });

      const isNew = !existing;
      if (isNew) created++;
      else updated++;

      // ─── Upsert FacultyApplication ───
      await prisma.facultyApplication.upsert({
        where: { facultyId: faculty.id },
        create: {
          facultyId: faculty.id,
          applicationData,
          status: "approved",
          submittedAt: s(row, COL.timestamp) ? new Date(s(row, COL.timestamp)) : new Date(),
          reviewedAt: new Date(),
          reviewNotes: "Imported from Google Form CSV — pre-approved",
        },
        update: {
          applicationData,
        },
      });

      // ─── Upsert FacultyTech ───
      const zoomFam = s(row, COL.zoomFamiliarity);
      const mic = s(row, COL.microphoneType);
      const wifi = s(row, COL.wifiReliable);
      if (zoomFam || mic || wifi) {
        await prisma.facultyTech.upsert({
          where: { facultyId: faculty.id },
          create: {
            facultyId: faculty.id,
            zoomLink: s(row, COL.zoomLink) || null,
            microphoneSetup: mic || null,
            cameraSetup: s(row, COL.dedicatedCamera) === "Yes"
              ? (s(row, COL.techSetupDesc) || "Yes")
              : "No dedicated setup",
            wifiQuality: wifi === "Yes" ? "good" : wifi ? "fair" : null,
            backupPlan: s(row, COL.backupPlan) === "Yes" ? "Has backup plan" : null,
            techNotes: [
              zoomFam ? `Zoom: ${zoomFam}` : "",
              s(row, COL.usesAiTools) === "Yes"
                ? `AI tools: ${s(row, COL.aiToolsExplanation) || "Yes"}`
                : "",
              s(row, COL.techSetupDesc) || "",
            ]
              .filter(Boolean)
              .join(" | ") || null,
          },
          update: {},
        });
      }

      // ─── Upsert AvailabilityPreferences ───
      const availGrid = buildAvailabilityGrid(row);
      if (Object.keys(availGrid).length > 0) {
        await prisma.availabilityPreferences.upsert({
          where: { facultyId: faculty.id },
          create: {
            facultyId: faculty.id,
            timezone: s(row, COL.timezone) || s(row, COL.timezone2) || null,
            weeklyHours: availGrid,
            seasonalNotes: s(row, COL.additionalTimes) || s(row, COL.otherAvailability) || null,
          },
          update: {},
        });
      }

      // ─── Create Consent records ───
      const consentFields: [string, number][] = [
        ["platform_fee_agreement", COL.consentPlatformFee],
        ["payout_agreement", COL.consentPaypal],
        ["tax_reporting", COL.consentTaxReporting],
        ["no_solicitation_agreement", COL.consentNoSolicitation],
        ["recording_policy", COL.consentNoRecording],
        ["in_person_liability", COL.consentInPersonLiability],
        ["conduct_policy", COL.consentConduct],
        ["terms_of_service", COL.consentPolicies],
      ];

      for (const [consentType, col] of consentFields) {
        const val = s(row, col);
        if (val) {
          // Only create if not already exists
          const existing = await prisma.consent.findFirst({
            where: { facultyId: faculty.id, consentType },
          });
          if (!existing) {
            await prisma.consent.create({
              data: {
                facultyId: faculty.id,
                consentType,
                version: "csv-import-v1",
                acceptedAt: s(row, COL.timestamp) ? new Date(s(row, COL.timestamp)) : new Date(),
              },
            });
          }
        }
      }

      // ─── Create SyncShopify records for existing Shopify IDs ───
      const privateProductId = s(row, COL.privateProductId);
      const masterclassProductId = s(row, COL.masterclassProductId);
      const groupProductId = s(row, COL.groupProductId);
      const collectionId = s(row, COL.collectionId);

      // Faculty collection
      if (collectionId) {
        const existing = await prisma.syncShopify.findFirst({
          where: {
            objectType: "faculty_collection",
            objectId: faculty.id,
          },
        });
        if (!existing) {
          await prisma.syncShopify.create({
            data: {
              objectType: "faculty_collection",
              objectId: faculty.id,
              shopifyObjectType: "collection",
              shopifyObjectId: `gid://shopify/Collection/${collectionId}`,
              shopifyHandle: null,
              syncStatus: "synced",
              lastSyncedAt: new Date(),
              syncSteps: { importedFrom: "csv", rawCollectionId: collectionId },
            },
          });
        }
      }

      // Offering products — we create Offering + SyncShopify for each
      const offeringTypes: [string, string, string][] = [
        [privateProductId, "private_lesson", s(row, COL.privateProductUrl)],
        [masterclassProductId, "masterclass", s(row, COL.masterclassProductUrl)],
        [groupProductId, "group_class", s(row, COL.groupProductUrl)],
      ];

      for (const [productId, offeringType, productUrl] of offeringTypes) {
        if (!productId) continue;

        // Check if we already have this offering
        const existingOffering = await prisma.offering.findFirst({
          where: { facultyId: faculty.id, offeringType },
        });

        if (!existingOffering) {
          const offering = await prisma.offering.create({
            data: {
              facultyId: faculty.id,
              offeringType,
              status: "approved",
              title: `${fullName} — ${offeringType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
              price: hourlyRate ?? 0,
              format: "online",
              durationMinutes: 60,
              approvedAt: new Date(),
            },
          });

          await prisma.syncShopify.create({
            data: {
              objectType: "offering_product",
              objectId: offering.id,
              shopifyObjectType: "product",
              shopifyObjectId: `gid://shopify/Product/${productId}`,
              shopifyHandle: null,
              syncStatus: "synced",
              lastSyncedAt: new Date(),
              syncSteps: {
                importedFrom: "csv",
                rawProductId: productId,
                rawProductUrl: productUrl,
              },
            },
          });
        }
      }

      // ─── Audit Log ───
      await prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "faculty.imported_from_csv",
          objectType: "faculty",
          objectId: faculty.id,
          details: {
            email,
            fullName,
            isNew,
            hasShopifyProducts: !!(privateProductId || masterclassProductId || groupProductId),
            hasCollection: !!collectionId,
          },
        },
      });

      console.log(
        `  ${isNew ? "CREATE" : "UPDATE"}: ${fullName} <${email}>` +
          (collectionId ? ` [collection:${collectionId}]` : "") +
          (privateProductId ? ` [private:${privateProductId}]` : "")
      );
    } catch (err) {
      console.error(`  ERROR: ${fullName} <${email}>:`, err);
      errors++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Import complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
