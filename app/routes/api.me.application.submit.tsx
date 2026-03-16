// POST /api/me/application/submit — submit the faculty application
// Saves all application data, creates FacultyApplication record,
// changes faculty status to pending_review, notifies admin

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { requireTeacherAuth } from "../lib/auth.server";
import { logAudit } from "../lib/audit.server";
import { calculateProfileCompleteness } from "../lib/workflows.server";
import {
  sendApplicationReceivedEmail,
  sendAdminNotification,
} from "../lib/email.server";
import { handleCorsOptions, withCors } from "../lib/cors.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsOptions(request);
  if (preflight) return preflight;
  return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return withCors(request, json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const auth = await requireTeacherAuth(request);
    const body = await request.json();

    const faculty = await prisma.faculty.findUniqueOrThrow({
      where: { id: auth.facultyId },
      include: { application: true },
    });

    // Only applicants and changes_requested can submit applications
    if (faculty.status !== "applicant" && faculty.status !== "changes_requested") {
      return withCors(request, json(
        { error: "You have already submitted an application" },
        { status: 400 },
      ));
    }

    // Validate required fields
    const fullName = body.fullName?.trim();
    const shortBio = body.shortBio?.trim();
    const primaryInstrument = body.primaryInstrument?.trim();
    const country = body.country?.trim();

    if (!fullName) {
      return withCors(request, json({ error: "Full name is required" }, { status: 400 }));
    }
    if (!shortBio) {
      return withCors(request, json({ error: "Short bio is required" }, { status: 400 }));
    }
    if (!primaryInstrument) {
      return withCors(request, json({ error: "Primary instrument is required" }, { status: 400 }));
    }
    if (!country) {
      return withCors(request, json({ error: "Country is required" }, { status: 400 }));
    }

    // Update faculty record with all application data (no gating for applicants)
    const updatedFaculty = await prisma.faculty.update({
      where: { id: auth.facultyId },
      data: {
        status: "pending_review",
        fullName,
        publicName: body.publicName?.trim() || fullName,
        shortBio,
        longBio: body.longBio?.trim() || null,
        credentials: body.credentials?.trim() || null,
        institutions: body.institutions?.trim() || null,
        specialties: body.specialties || [],
        primaryInstrument,
        division: body.division || null,
        country,
        city: body.city?.trim() || null,
        timezone: body.timezone || null,
        teachingLanguages: body.teachingLanguages || [],
        yearsExperience: body.yearsExperience || null,
        phone: body.phone?.trim() || null,
        websiteUrl: body.websiteUrl?.trim() || null,
        headshotUrl: body.headshotUrl?.trim() || null,
        socialInstagram: body.socialInstagram?.trim() || null,
        socialYoutube: body.socialYoutube?.trim() || null,
      },
    });

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(updatedFaculty);
    await prisma.faculty.update({
      where: { id: auth.facultyId },
      data: { profileCompleteness: completeness },
    });

    // Create or update FacultyApplication record
    const applicationData = {
      fullName,
      publicName: body.publicName?.trim() || fullName,
      shortBio,
      credentials: body.credentials?.trim() || null,
      institutions: body.institutions?.trim() || null,
      specialties: body.specialties || [],
      primaryInstrument,
      division: body.division || null,
      country,
      city: body.city?.trim() || null,
      timezone: body.timezone || null,
      teachingLanguages: body.teachingLanguages || [],
      yearsExperience: body.yearsExperience || null,
      websiteUrl: body.websiteUrl?.trim() || null,
      headshotUrl: body.headshotUrl?.trim() || null,
      socialInstagram: body.socialInstagram?.trim() || null,
      socialYoutube: body.socialYoutube?.trim() || null,
    };

    if (faculty.application) {
      // Update existing (e.g., re-submission after changes_requested)
      await prisma.facultyApplication.update({
        where: { id: faculty.application.id },
        data: {
          applicationData,
          status: "pending_review",
          submittedAt: new Date(),
          reviewedAt: null,
          reviewerId: null,
          reviewNotes: null,
        },
      });
    } else {
      // Create new
      await prisma.facultyApplication.create({
        data: {
          facultyId: auth.facultyId,
          applicationData,
          status: "pending_review",
        },
      });
    }

    // Create approval record
    await prisma.approval.create({
      data: {
        objectType: "faculty",
        objectId: auth.facultyId,
        actionType: "new_application",
        status: "pending",
        submittedBy: auth.facultyId,
      },
    });

    await logAudit({
      actorType: "teacher",
      actorId: auth.facultyId,
      action: "application.submitted",
      objectType: "faculty",
      objectId: auth.facultyId,
    });

    // Send emails
    const teacherName = body.publicName?.trim() || fullName;
    await sendApplicationReceivedEmail(faculty.email, teacherName);
    await sendAdminNotification("application", {
      teacherName,
      teacherEmail: faculty.email,
    });

    return withCors(request, json({
      success: true,
      message: "Application submitted successfully",
    }));
  } catch (error) {
    console.error("Application submission error:", error);
    return withCors(request, json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    ));
  }
}
