import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Banner,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  FormLayout,
  Tabs,
  Divider,
  IndexTable,
  Thumbnail,
  Box,
  Modal,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Faculty ID required", faculty: null }, { status: 400 });
  }

  try {
    const [facultyBase, adminComments, syncShopify, syncAppointo, auditLogs] = await Promise.all([
      prisma.faculty.findUnique({
        where: { id },
        include: {
          offerings: {
            select: {
              id: true,
              title: true,
              offeringType: true,
              status: true,
              price: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          profileEdits: {
            orderBy: { submittedAt: "desc" },
          },
          availability: true,
        },
      }),
      prisma.adminComment.findMany({
        where: { objectType: "faculty", objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncShopify.findMany({
        where: { objectId: id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.syncAppointo.findMany({
        where: { objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { objectId: id },
            { actorId: id },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    if (!facultyBase) {
      return json({ error: "Faculty not found", faculty: null }, { status: 404 });
    }

    const faculty = { ...facultyBase, adminComments, syncShopify, syncAppointo };

    return json({ faculty, auditLogs, error: null });
  } catch (error) {
    console.error("Faculty detail error:", error);
    return json({ error: "Failed to load faculty", faculty: null, auditLogs: [] }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Faculty ID required" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "update_profile") {
      const updateData: Record<string, any> = {};
      const fields = [
        "fullName", "publicName", "email", "phone", "country", "city",
        "timezone", "shortBio", "longBio", "credentials", "institutions",
        "awards", "primaryInstrument", "division", "websiteUrl",
        "socialInstagram", "socialYoutube", "socialLinkedin",
        "socialTwitter", "introVideoUrl", "zoomLink",
      ];

      for (const field of fields) {
        const val = formData.get(field);
        if (val !== null) {
          updateData[field] = val === "" ? null : String(val);
        }
      }

      const yearsExp = formData.get("yearsExperience");
      if (yearsExp !== null) {
        updateData.yearsExperience = yearsExp ? parseInt(String(yearsExp), 10) : null;
      }

      await prisma.faculty.update({
        where: { id },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "faculty.profile_updated",
          objectType: "faculty",
          objectId: id,
          details: { fields: Object.keys(updateData) },
        },
      });

      return json({ success: true, message: "Profile updated" });
    }

    if (intent === "update_status") {
      const newStatus = formData.get("status") as string;
      const validStatuses = [
        "active", "approved", "paused", "suspended", "archived",
      ];

      if (!validStatuses.includes(newStatus)) {
        return json({ error: "Invalid status" }, { status: 400 });
      }

      await prisma.faculty.update({
        where: { id },
        data: { status: newStatus },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: `faculty.status_changed`,
          objectType: "faculty",
          objectId: id,
          details: { newStatus },
        },
      });

      return json({ success: true, message: `Status changed to ${newStatus}` });
    }

    if (intent === "toggle_published") {
      const faculty = await prisma.faculty.findUnique({
        where: { id },
        select: { profilePublished: true },
      });

      const newVal = !faculty?.profilePublished;
      await prisma.faculty.update({
        where: { id },
        data: { profilePublished: newVal },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: newVal ? "faculty.profile_published" : "faculty.profile_unpublished",
          objectType: "faculty",
          objectId: id,
        },
      });

      return json({ success: true, message: newVal ? "Profile published" : "Profile unpublished" });
    }

    if (intent === "approve_edit") {
      const editId = formData.get("editId") as string;

      const edit = await prisma.profileEdit.findUnique({ where: { id: editId } });
      if (!edit || edit.status !== "pending_approval") {
        return json({ error: "Edit not found or already processed" }, { status: 400 });
      }

      const changes = edit.changes as Record<string, any>;

      await prisma.$transaction([
        prisma.faculty.update({
          where: { id },
          data: changes,
        }),
        prisma.profileEdit.update({
          where: { id: editId },
          data: {
            status: "approved",
            reviewedAt: new Date(),
            reviewerId: session.id,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "profile_edit.approved",
            objectType: "profile_edit",
            objectId: editId,
          },
        }),
      ]);

      return json({ success: true, message: "Edit approved and applied" });
    }

    if (intent === "reject_edit") {
      const editId = formData.get("editId") as string;
      const notes = formData.get("notes") as string;

      await prisma.$transaction([
        prisma.profileEdit.update({
          where: { id: editId },
          data: {
            status: "rejected",
            reviewedAt: new Date(),
            reviewerId: session.id,
            reviewNotes: notes || null,
          },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "profile_edit.rejected",
            objectType: "profile_edit",
            objectId: editId,
          },
        }),
      ]);

      return json({ success: true, message: "Edit rejected" });
    }

    if (intent === "retry_sync") {
      const syncId = formData.get("syncId") as string;
      await prisma.syncShopify.update({
        where: { id: syncId },
        data: { syncStatus: "pending", lastError: null, retryCount: { increment: 1 } },
      });
      return json({ success: true, message: "Sync retry queued" });
    }

    if (intent === "add_comment") {
      const comment = formData.get("comment") as string;
      const visibleToTeacher = formData.get("visibleToTeacher") === "true";
      if (!comment?.trim()) {
        return json({ error: "Comment is required" }, { status: 400 });
      }
      await prisma.adminComment.create({
        data: {
          objectType: "faculty",
          objectId: id,
          authorId: session.id,
          comment: comment.trim(),
          visibleToTeacher,
        },
      });
      return json({ success: true, message: "Comment added" });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Faculty action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

function statusBadge(status: string) {
  const toneMap: Record<string, any> = {
    active: "success",
    approved: "info",
    applicant: undefined,
    pending_review: "attention",
    changes_requested: "warning",
    paused: "attention",
    suspended: "critical",
    archived: undefined,
    rejected: "critical",
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function offeringStatusBadge(status: string) {
  const toneMap: Record<string, any> = {
    live: "success",
    approved: "info",
    pending_approval: "attention",
    draft: undefined,
    paused: "attention",
    suspended: "critical",
    archived: undefined,
    rejected: "critical",
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function syncStatusBadge(status: string) {
  const toneMap: Record<string, any> = {
    synced: "success",
    pending: "attention",
    failed: "critical",
    needs_update: "warning",
    manual: "info",
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

export default function FacultyDetailPage() {
  const { faculty, auditLogs, error } = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [commentVisible, setCommentVisible] = useState(true);

  const actionData = fetcher.data as any;
  const isSubmitting = fetcher.state !== "idle";

  if (error && !faculty) {
    return (
      <Page
        title="Faculty Not Found"
        backAction={{ content: "Faculty", url: "/app/faculty" }}
      >
        <Banner tone="critical"><p>{error}</p></Banner>
      </Page>
    );
  }

  if (!faculty) return null;

  // Form state for profile editing
  const [formState, setFormState] = useState({
    fullName: faculty.fullName || "",
    publicName: faculty.publicName || "",
    email: faculty.email || "",
    phone: faculty.phone || "",
    country: faculty.country || "",
    city: faculty.city || "",
    timezone: faculty.timezone || "",
    shortBio: faculty.shortBio || "",
    longBio: faculty.longBio || "",
    credentials: faculty.credentials || "",
    institutions: faculty.institutions || "",
    awards: faculty.awards || "",
    primaryInstrument: faculty.primaryInstrument || "",
    division: faculty.division || "",
    yearsExperience: faculty.yearsExperience?.toString() || "",
    websiteUrl: faculty.websiteUrl || "",
    socialInstagram: faculty.socialInstagram || "",
    socialYoutube: faculty.socialYoutube || "",
    socialLinkedin: faculty.socialLinkedin || "",
    socialTwitter: faculty.socialTwitter || "",
    introVideoUrl: faculty.introVideoUrl || "",
    zoomLink: faculty.zoomLink || "",
  });

  const handleFormChange = (field: string) => (value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    const data = new FormData();
    data.set("intent", "update_profile");
    Object.entries(formState).forEach(([key, val]) => {
      data.set(key, val);
    });
    fetcher.submit(data, { method: "POST" });
  };

  const handleStatusChange = (newStatus: string) => {
    fetcher.submit(
      { intent: "update_status", status: newStatus },
      { method: "POST" },
    );
  };

  const handleTogglePublished = () => {
    fetcher.submit({ intent: "toggle_published" }, { method: "POST" });
  };

  const tabs = [
    { id: "profile", content: "Profile" },
    { id: "offerings", content: `Offerings (${faculty.offerings?.length || 0})` },
    { id: "availability", content: "Availability" },
    { id: "sync", content: "Sync" },
    { id: "history", content: "History" },
  ];

  const pendingEdits = (faculty.profileEdits || []).filter(
    (e: any) => e.status === "pending_approval",
  );

  return (
    <Page
      title={faculty.fullName || faculty.publicName || "Faculty Detail"}
      subtitle={faculty.email}
      backAction={{ content: "Faculty", url: "/app/faculty" }}
      titleMetadata={statusBadge(faculty.status)}
      primaryAction={{
        content: faculty.profilePublished ? "Unpublish Profile" : "Publish Profile",
        onAction: handleTogglePublished,
        loading: isSubmitting,
      }}
      secondaryActions={[
        ...(faculty.status !== "suspended"
          ? [{ content: "Suspend", destructive: true, onAction: () => handleStatusChange("suspended") }]
          : [{ content: "Reactivate", onAction: () => handleStatusChange("active") }]),
        ...(faculty.status !== "archived"
          ? [{ content: "Archive", onAction: () => handleStatusChange("archived") }]
          : []),
      ]}
    >
      <TitleBar title={faculty.fullName || "Faculty Detail"} />

      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success" onDismiss={() => {}}>
            <p>{actionData.message}</p>
          </Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical" onDismiss={() => {}}>
            <p>{actionData.error}</p>
          </Banner>
        )}

        {/* Pending Profile Edits */}
        {pendingEdits.length > 0 && (
          <Banner tone="warning" title={`${pendingEdits.length} pending profile edit(s)`}>
            <BlockStack gap="300">
              {pendingEdits.map((edit: any) => (
                <Card key={edit.id}>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Submitted {new Date(edit.submittedAt).toLocaleDateString()}
                    </Text>
                    {Object.entries(edit.changes as Record<string, any>).map(
                      ([field, newVal]) => (
                        <InlineStack key={field} gap="200">
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {field}:
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {String((faculty as any)[field] || "(empty)")}
                          </Text>
                          <Text as="span" variant="bodySm">
                            {" -> "}
                          </Text>
                          <Text as="span" variant="bodySm" fontWeight="bold">
                            {String(newVal)}
                          </Text>
                        </InlineStack>
                      ),
                    )}
                    <InlineStack gap="200">
                      <Button
                        size="slim"
                        variant="primary"
                        onClick={() =>
                          fetcher.submit(
                            { intent: "approve_edit", editId: edit.id },
                            { method: "POST" },
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="slim"
                        tone="critical"
                        onClick={() =>
                          fetcher.submit(
                            { intent: "reject_edit", editId: edit.id, notes: "" },
                            { method: "POST" },
                          )
                        }
                      >
                        Reject
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          </Banner>
        )}

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {/* Profile Tab */}
          {selectedTab === 0 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Edit Profile</Text>
                    <Divider />
                    <FormLayout>
                      <FormLayout.Group>
                        <TextField label="Full Name" value={formState.fullName} onChange={handleFormChange("fullName")} autoComplete="off" />
                        <TextField label="Public Name" value={formState.publicName} onChange={handleFormChange("publicName")} autoComplete="off" />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField label="Email" value={formState.email} onChange={handleFormChange("email")} autoComplete="off" type="email" />
                        <TextField label="Phone" value={formState.phone} onChange={handleFormChange("phone")} autoComplete="off" />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField label="Country" value={formState.country} onChange={handleFormChange("country")} autoComplete="off" />
                        <TextField label="City" value={formState.city} onChange={handleFormChange("city")} autoComplete="off" />
                        <TextField label="Timezone" value={formState.timezone} onChange={handleFormChange("timezone")} autoComplete="off" />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField label="Primary Instrument" value={formState.primaryInstrument} onChange={handleFormChange("primaryInstrument")} autoComplete="off" />
                        <Select
                          label="Division"
                          options={[
                            { label: "Select...", value: "" },
                            { label: "Voice", value: "Voice" },
                            { label: "Piano", value: "Piano" },
                            { label: "Strings", value: "Strings" },
                            { label: "Winds", value: "Winds" },
                            { label: "Brass", value: "Brass" },
                            { label: "Percussion", value: "Percussion" },
                            { label: "Composition", value: "Composition" },
                            { label: "Theory", value: "Theory" },
                            { label: "Conducting", value: "Conducting" },
                            { label: "Other", value: "Other" },
                          ]}
                          value={formState.division}
                          onChange={handleFormChange("division")}
                        />
                        <TextField label="Years Experience" value={formState.yearsExperience} onChange={handleFormChange("yearsExperience")} autoComplete="off" type="number" />
                      </FormLayout.Group>
                      <TextField label="Short Bio" value={formState.shortBio} onChange={handleFormChange("shortBio")} autoComplete="off" multiline={3} />
                      <TextField label="Long Bio" value={formState.longBio} onChange={handleFormChange("longBio")} autoComplete="off" multiline={6} />
                      <FormLayout.Group>
                        <TextField label="Credentials" value={formState.credentials} onChange={handleFormChange("credentials")} autoComplete="off" multiline={2} />
                        <TextField label="Institutions" value={formState.institutions} onChange={handleFormChange("institutions")} autoComplete="off" multiline={2} />
                      </FormLayout.Group>
                      <TextField label="Awards" value={formState.awards} onChange={handleFormChange("awards")} autoComplete="off" multiline={2} />
                      <Divider />
                      <Text as="h3" variant="headingSm">Links</Text>
                      <FormLayout.Group>
                        <TextField label="Website URL" value={formState.websiteUrl} onChange={handleFormChange("websiteUrl")} autoComplete="off" type="url" />
                        <TextField label="Intro Video URL" value={formState.introVideoUrl} onChange={handleFormChange("introVideoUrl")} autoComplete="off" type="url" />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField label="Zoom Link" value={formState.zoomLink} onChange={handleFormChange("zoomLink")} autoComplete="off" />
                        <TextField label="Instagram" value={formState.socialInstagram} onChange={handleFormChange("socialInstagram")} autoComplete="off" />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField label="YouTube" value={formState.socialYoutube} onChange={handleFormChange("socialYoutube")} autoComplete="off" />
                        <TextField label="LinkedIn" value={formState.socialLinkedin} onChange={handleFormChange("socialLinkedin")} autoComplete="off" />
                        <TextField label="Twitter/X" value={formState.socialTwitter} onChange={handleFormChange("socialTwitter")} autoComplete="off" />
                      </FormLayout.Group>
                    </FormLayout>
                    <InlineStack align="end">
                      <Button variant="primary" onClick={handleSaveProfile} loading={isSubmitting}>
                        Save Profile
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* Admin Comments */}
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Admin Notes</Text>
                    <Divider />
                    {faculty.adminComments?.length > 0 ? (
                      <BlockStack gap="200">
                        {faculty.adminComments.map((c: any) => (
                          <Box key={c.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                            <BlockStack gap="100">
                              <InlineStack align="space-between">
                                <Text as="span" variant="bodySm" fontWeight="semibold">{c.authorId || "Admin"}</Text>
                                <InlineStack gap="200">
                                  {!c.visibleToTeacher && <Badge tone="info">Internal</Badge>}
                                  <Text as="span" variant="bodySm" tone="subdued">{new Date(c.createdAt).toLocaleDateString()}</Text>
                                </InlineStack>
                              </InlineStack>
                              <Text as="p" variant="bodyMd">{c.comment}</Text>
                            </BlockStack>
                          </Box>
                        ))}
                      </BlockStack>
                    ) : (
                      <Text as="p" tone="subdued">No notes yet.</Text>
                    )}
                    <Divider />
                    <FormLayout>
                      <TextField label="Add a note" value={newComment} onChange={setNewComment} multiline={3} autoComplete="off" />
                      <InlineStack gap="300" blockAlign="center">
                        <Button onClick={() => {
                          if (!newComment.trim()) return;
                          fetcher.submit({
                            intent: "add_comment",
                            comment: newComment,
                            visibleToTeacher: commentVisible.toString(),
                          }, { method: "POST" });
                          setNewComment("");
                        }}>Add Note</Button>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                          <input type="checkbox" checked={commentVisible} onChange={(e) => setCommentVisible(e.target.checked)} />
                          Visible to teacher
                        </label>
                      </InlineStack>
                    </FormLayout>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Quick Info</Text>
                    <Divider />
                    {faculty.headshotUrl && (
                      <Thumbnail source={faculty.headshotUrl} alt={faculty.fullName || ""} size="large" />
                    )}
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Status:</Text>
                      {statusBadge(faculty.status)}
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Published:</Text>
                      <Badge tone={faculty.profilePublished ? "success" : undefined}>
                        {faculty.profilePublished ? "Yes" : "No"}
                      </Badge>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Completeness:</Text>
                      <Text as="span" variant="bodySm">{faculty.profileCompleteness}%</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Accepting:</Text>
                      <Badge tone={faculty.acceptingStudents ? "success" : undefined}>
                        {faculty.acceptingStudents ? "Yes" : "No"}
                      </Badge>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Featured:</Text>
                      <Badge tone={faculty.featured ? "success" : undefined}>
                        {faculty.featured ? "Yes" : "No"}
                      </Badge>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Joined:</Text>
                      <Text as="span" variant="bodySm">{new Date(faculty.createdAt).toLocaleDateString()}</Text>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          )}

          {/* Offerings Tab */}
          {selectedTab === 1 && (
            <Card padding="0">
              {faculty.offerings?.length === 0 ? (
                <div style={{ padding: "16px" }}>
                  <Text as="p" tone="subdued">No offerings yet.</Text>
                </div>
              ) : (
                <IndexTable
                  resourceName={{ singular: "offering", plural: "offerings" }}
                  itemCount={faculty.offerings.length}
                  headings={[
                    { title: "Title" },
                    { title: "Type" },
                    { title: "Status" },
                    { title: "Price" },
                    { title: "Created" },
                  ]}
                  selectable={false}
                >
                  {faculty.offerings.map((o: any, i: number) => (
                    <IndexTable.Row key={o.id} id={o.id} position={i} onClick={() => navigate(`/app/offerings/${o.id}`)}>
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="bold">{o.title || "Untitled"}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{o.offeringType?.replace(/_/g, " ") || "-"}</IndexTable.Cell>
                      <IndexTable.Cell>{offeringStatusBadge(o.status)}</IndexTable.Cell>
                      <IndexTable.Cell>${Number(o.price).toFixed(2)}</IndexTable.Cell>
                      <IndexTable.Cell>{new Date(o.createdAt).toLocaleDateString()}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Card>
          )}

          {/* Availability Tab */}
          {selectedTab === 2 && (
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Availability Preferences</Text>
                <Divider />
                {faculty.availability ? (
                  <BlockStack gap="200">
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Timezone:</Text>
                      <Text as="span" variant="bodySm">{faculty.availability.timezone || "-"}</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Lead Time:</Text>
                      <Text as="span" variant="bodySm">{faculty.availability.leadTimeHours ? `${faculty.availability.leadTimeHours}h` : "-"}</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Buffer:</Text>
                      <Text as="span" variant="bodySm">{faculty.availability.bufferMinutes ? `${faculty.availability.bufferMinutes}min` : "-"}</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Max Sessions/Day:</Text>
                      <Text as="span" variant="bodySm">{faculty.availability.maxSessionsPerDay || "-"}</Text>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">Pause Mode:</Text>
                      <Badge tone={faculty.availability.pauseMode ? "warning" : "success"}>
                        {faculty.availability.pauseMode ? "Paused" : "Active"}
                      </Badge>
                    </InlineStack>
                    {faculty.availability.pauseReason && (
                      <InlineStack gap="200">
                        <Text as="span" variant="bodySm" fontWeight="semibold">Pause Reason:</Text>
                        <Text as="span" variant="bodySm">{faculty.availability.pauseReason}</Text>
                      </InlineStack>
                    )}
                    {faculty.availability.seasonalNotes && (
                      <>
                        <Divider />
                        <Text as="p" variant="bodySm" fontWeight="semibold">Seasonal Notes:</Text>
                        <Text as="p" variant="bodySm">{faculty.availability.seasonalNotes}</Text>
                      </>
                    )}
                    {faculty.availability.weeklyHours && (
                      <>
                        <Divider />
                        <Text as="p" variant="bodySm" fontWeight="semibold">Weekly Hours:</Text>
                        <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                          <pre style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap" }}>
                            {JSON.stringify(faculty.availability.weeklyHours, null, 2)}
                          </pre>
                        </Box>
                      </>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">No availability preferences set.</Text>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Sync Tab */}
          {selectedTab === 3 && (
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Shopify Sync Records</Text>
                  <Divider />
                  {faculty.syncShopify?.length === 0 ? (
                    <Text as="p" tone="subdued">No Shopify sync records.</Text>
                  ) : (
                    <BlockStack gap="300">
                      {faculty.syncShopify.map((s: any) => (
                        <Box key={s.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="100">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                {s.objectType} / {s.shopifyObjectType}
                              </Text>
                              {syncStatusBadge(s.syncStatus)}
                            </InlineStack>
                            {s.shopifyObjectId && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                Shopify ID: {s.shopifyObjectId}
                              </Text>
                            )}
                            {s.lastSyncedAt && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                Last synced: {new Date(s.lastSyncedAt).toLocaleString()}
                              </Text>
                            )}
                            {s.lastError && (
                              <Banner tone="critical">
                                <p>{s.lastError}</p>
                              </Banner>
                            )}
                            {s.syncStatus === "failed" && (
                              <Button
                                size="slim"
                                onClick={() =>
                                  fetcher.submit(
                                    { intent: "retry_sync", syncId: s.id },
                                    { method: "POST" },
                                  )
                                }
                              >
                                Retry
                              </Button>
                            )}
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Appointo Sync Records</Text>
                  <Divider />
                  {faculty.syncAppointo?.length === 0 ? (
                    <Text as="p" tone="subdued">No Appointo sync records.</Text>
                  ) : (
                    <BlockStack gap="300">
                      {faculty.syncAppointo.map((s: any) => (
                        <Box key={s.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="100">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm" fontWeight="semibold">{s.objectType}</Text>
                              {syncStatusBadge(s.syncStatus)}
                            </InlineStack>
                            {s.appointoId && (
                              <Text as="span" variant="bodySm" tone="subdued">Appointo ID: {s.appointoId}</Text>
                            )}
                            {s.configurationNotes && (
                              <Text as="span" variant="bodySm">{s.configurationNotes}</Text>
                            )}
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          )}

          {/* History Tab */}
          {selectedTab === 4 && (
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Audit History</Text>
                <Divider />
                {auditLogs?.length === 0 ? (
                  <Text as="p" tone="subdued">No audit history.</Text>
                ) : (
                  <BlockStack gap="200">
                    {auditLogs.map((log: any) => (
                      <Box key={log.id} padding="200" borderBlockEndWidth="025" borderColor="border">
                        <InlineStack align="space-between" wrap={false}>
                          <BlockStack gap="050">
                            <InlineStack gap="200" blockAlign="center">
                              <Badge tone={log.actorType === "admin" ? "info" : log.actorType === "system" ? "attention" : undefined}>
                                {log.actorType}
                              </Badge>
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                {log.action.replace(/\./g, " > ").replace(/_/g, " ")}
                              </Text>
                            </InlineStack>
                            {log.details && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                {typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)}
                              </Text>
                            )}
                          </BlockStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {new Date(log.createdAt).toLocaleString()}
                          </Text>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          )}
        </Tabs>
      </BlockStack>
    </Page>
  );
}
