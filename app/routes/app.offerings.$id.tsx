import { useState } from "react";
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
  Modal,
  Divider,
  Box,
  FormLayout,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Offering ID required", offering: null }, { status: 400 });
  }

  try {
    const [offeringBase, adminComments, syncShopify] = await Promise.all([
      prisma.offering.findUnique({
        where: { id },
        include: {
          faculty: {
            select: {
              id: true,
              fullName: true,
              publicName: true,
              email: true,
              status: true,
            },
          },
          edits: {
            orderBy: { submittedAt: "desc" },
          },
        },
      }),
      prisma.adminComment.findMany({
        where: { objectType: "offering", objectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncShopify.findMany({
        where: { objectId: id },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (!offeringBase) {
      return json({ error: "Offering not found", offering: null }, { status: 404 });
    }

    const offering = { ...offeringBase, adminComments, syncShopify };

    return json({ offering, error: null });
  } catch (error) {
    console.error("Offering detail error:", error);
    return json({ error: "Failed to load offering", offering: null }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Offering ID required" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "approve") {
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "approved", approvedAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.approved",
            objectType: "offering",
            objectId: id,
          },
        }),
      ]);
      return json({ success: true, message: "Offering approved" });
    }

    if (intent === "approve_and_hold") {
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "approved", approvedAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.approved_held",
            objectType: "offering",
            objectId: id,
            details: { note: "Approved but held from publishing" },
          },
        }),
      ]);
      return json({ success: true, message: "Offering approved (held)" });
    }

    if (intent === "reject") {
      const notes = formData.get("notes") as string;
      if (!notes?.trim()) {
        return json({ error: "Rejection notes are required" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "rejected" },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.rejected",
            objectType: "offering",
            objectId: id,
            details: { notes: notes.trim() },
          },
        }),
      ]);
      return json({ success: true, message: "Offering rejected" });
    }

    if (intent === "request_changes") {
      const notes = formData.get("notes") as string;
      if (!notes?.trim()) {
        return json({ error: "Feedback is required" }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "draft" },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.changes_requested",
            objectType: "offering",
            objectId: id,
            details: { notes: notes.trim() },
          },
        }),
      ]);
      return json({ success: true, message: "Changes requested" });
    }

    if (intent === "publish") {
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "live", publishedAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.published",
            objectType: "offering",
            objectId: id,
          },
        }),
      ]);
      return json({ success: true, message: "Offering published" });
    }

    if (intent === "unpublish") {
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "approved" },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.unpublished",
            objectType: "offering",
            objectId: id,
          },
        }),
      ]);
      return json({ success: true, message: "Offering unpublished" });
    }

    if (intent === "suspend") {
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: { status: "suspended" },
        }),
        prisma.auditLog.create({
          data: {
            actorType: "admin",
            actorId: session.id,
            action: "offering.suspended",
            objectType: "offering",
            objectId: id,
          },
        }),
      ]);
      return json({ success: true, message: "Offering suspended" });
    }

    if (intent === "approve_edit") {
      const editId = formData.get("editId") as string;
      const edit = await prisma.offeringEdit.findUnique({ where: { id: editId } });
      if (!edit || edit.status !== "pending_approval") {
        return json({ error: "Edit not found or already processed" }, { status: 400 });
      }

      const changes = edit.changes as Record<string, any>;
      await prisma.$transaction([
        prisma.offering.update({
          where: { id },
          data: changes,
        }),
        prisma.offeringEdit.update({
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
            action: "offering_edit.approved",
            objectType: "offering_edit",
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
        prisma.offeringEdit.update({
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
            action: "offering_edit.rejected",
            objectType: "offering_edit",
            objectId: editId,
          },
        }),
      ]);
      return json({ success: true, message: "Edit rejected" });
    }

    if (intent === "add_comment") {
      const comment = formData.get("comment") as string;
      const visibleToTeacher = formData.get("visibleToTeacher") === "true";
      if (!comment?.trim()) {
        return json({ error: "Comment is required" }, { status: 400 });
      }
      await prisma.adminComment.create({
        data: {
          objectType: "offering",
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
    console.error("Offering action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

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
  };
  return (
    <Badge tone={toneMap[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OfferingDetailPage() {
  const { offering, error } = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [modalNotes, setModalNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentVisible, setCommentVisible] = useState(true);

  const isSubmitting = fetcher.state !== "idle";
  const actionData = fetcher.data as any;

  if (error && !offering) {
    return (
      <Page
        title="Offering Not Found"
        backAction={{ content: "Offerings", url: "/app/offerings" }}
      >
        <Banner tone="critical"><p>{error}</p></Banner>
      </Page>
    );
  }

  if (!offering) return null;

  const pendingEdits = (offering.edits || []).filter(
    (e: any) => e.status === "pending_approval",
  );

  const offeringFields = [
    { label: "Type", value: offering.offeringType?.replace(/_/g, " ") },
    { label: "Title", value: offering.title },
    { label: "Description", value: offering.description },
    { label: "Topic", value: offering.topic },
    { label: "Level", value: offering.level },
    { label: "Age Groups", value: offering.ageGroups?.join(", ") },
    { label: "Format", value: offering.format },
    { label: "Duration", value: offering.durationMinutes ? `${offering.durationMinutes} min` : null },
    { label: "Price", value: `$${Number(offering.price).toFixed(2)} ${offering.currency}` },
    { label: "Capacity", value: offering.capacity },
    { label: "Prerequisites", value: offering.prerequisites },
    { label: "Materials Required", value: offering.materialsRequired },
    { label: "Recording Allowed", value: offering.recordingAllowed != null ? (offering.recordingAllowed ? "Yes" : "No") : null },
    { label: "Replay Allowed", value: offering.replayAllowed != null ? (offering.replayAllowed ? "Yes" : "No") : null },
    { label: "Accepting Students", value: offering.acceptingStudents ? "Yes" : "No" },
    { label: "One-Time", value: offering.oneTime ? "Yes" : "No" },
    { label: "Recurring Rule", value: offering.recurringRule },
    { label: "Proposed Start", value: offering.proposedStartDate ? new Date(offering.proposedStartDate).toLocaleDateString() : null },
    { label: "Proposed End", value: offering.proposedEndDate ? new Date(offering.proposedEndDate).toLocaleDateString() : null },
    { label: "Proposed Schedule", value: offering.proposedSchedule },
    { label: "Series Length", value: offering.seriesLength },
    { label: "Term Name", value: offering.termName },
    { label: "Syllabus", value: offering.syllabus },
    { label: "Application Required", value: offering.applicationRequired ? "Yes" : "No" },
    { label: "Performer Seats", value: offering.performerSeats },
    { label: "Observer Seats", value: offering.observerSeats },
    { label: "Event Type", value: offering.eventType },
  ].filter((f) => f.value != null && f.value !== "" && f.value !== "No" || f.label === "Price");

  return (
    <Page
      title={offering.title || "Untitled Offering"}
      subtitle={`by ${offering.faculty?.fullName || offering.faculty?.email || "Unknown"}`}
      backAction={{ content: "Offerings", url: "/app/offerings" }}
      titleMetadata={offeringStatusBadge(offering.status)}
    >
      <TitleBar title={offering.title || "Offering Detail"} />
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success" onDismiss={() => {}}><p>{actionData.message}</p></Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical" onDismiss={() => {}}><p>{actionData.error}</p></Banner>
        )}

        {/* Action Buttons */}
        <Card>
          <InlineStack gap="300" wrap>
            {offering.status === "pending_approval" && (
              <>
                <Button variant="primary" tone="success" onClick={() => fetcher.submit({ intent: "approve" }, { method: "POST" })} loading={isSubmitting}>
                  Approve
                </Button>
                <Button onClick={() => fetcher.submit({ intent: "approve_and_hold" }, { method: "POST" })} loading={isSubmitting}>
                  Approve & Hold
                </Button>
                <Button tone="critical" onClick={() => setRejectModalOpen(true)} disabled={isSubmitting}>
                  Reject
                </Button>
                <Button onClick={() => setChangesModalOpen(true)} disabled={isSubmitting}>
                  Request Changes
                </Button>
              </>
            )}
            {offering.status === "approved" && (
              <Button variant="primary" onClick={() => fetcher.submit({ intent: "publish" }, { method: "POST" })} loading={isSubmitting}>
                Publish
              </Button>
            )}
            {offering.status === "live" && (
              <>
                <Button onClick={() => fetcher.submit({ intent: "unpublish" }, { method: "POST" })} loading={isSubmitting}>
                  Unpublish
                </Button>
                <Button tone="critical" onClick={() => fetcher.submit({ intent: "suspend" }, { method: "POST" })} loading={isSubmitting}>
                  Suspend
                </Button>
              </>
            )}
            <Button variant="plain" onClick={() => navigate(`/app/faculty/${offering.faculty?.id}`)}>
              View Teacher Profile
            </Button>
          </InlineStack>
        </Card>

        {/* Pending Edits */}
        {pendingEdits.length > 0 && (
          <Banner tone="warning" title={`${pendingEdits.length} pending edit(s)`}>
            <BlockStack gap="400">
              {pendingEdits.map((edit: any) => (
                <Card key={edit.id}>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Submitted {new Date(edit.submittedAt).toLocaleDateString()}
                    </Text>
                    <BlockStack gap="100">
                      {Object.entries(edit.changes as Record<string, any>).map(
                        ([field, newVal]) => (
                          <InlineStack key={field} gap="200" wrap={false}>
                            <Box minWidth="150px">
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                {formatFieldName(field)}:
                              </Text>
                            </Box>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {String((offering as any)[field] || "(empty)")}
                            </Text>
                            <Text as="span" variant="bodySm"> {"->"} </Text>
                            <Text as="span" variant="bodySm" fontWeight="bold">
                              {String(newVal)}
                            </Text>
                          </InlineStack>
                        ),
                      )}
                    </BlockStack>
                    <InlineStack gap="200">
                      <Button size="slim" variant="primary" onClick={() =>
                        fetcher.submit({ intent: "approve_edit", editId: edit.id }, { method: "POST" })
                      }>
                        Approve Edit
                      </Button>
                      <Button size="slim" tone="critical" onClick={() =>
                        fetcher.submit({ intent: "reject_edit", editId: edit.id, notes: "" }, { method: "POST" })
                      }>
                        Reject Edit
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            {/* Offering Details */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Offering Details</Text>
                <Divider />
                <BlockStack gap="200">
                  {offeringFields.map((f) => (
                    <InlineStack key={f.label} gap="400" wrap={false}>
                      <Box minWidth="180px">
                        <Text as="span" variant="bodySm" fontWeight="semibold">{f.label}</Text>
                      </Box>
                      <Text as="span" variant="bodySm">
                        {typeof f.value === "string" && f.value.length > 200
                          ? f.value.substring(0, 200) + "..."
                          : String(f.value || "-")}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
                {offering.description && offering.description.length > 200 && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">Full Description</Text>
                    <Text as="p" variant="bodyMd">{offering.description}</Text>
                  </>
                )}
                {offering.syllabus && (
                  <>
                    <Divider />
                    <Text as="h3" variant="headingSm">Syllabus</Text>
                    <Text as="p" variant="bodyMd">{offering.syllabus}</Text>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Admin Comments */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Admin Comments</Text>
                <Divider />
                {offering.adminComments?.length > 0 ? (
                  <BlockStack gap="200">
                    {offering.adminComments.map((c: any) => (
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
                  <Text as="p" tone="subdued">No comments yet.</Text>
                )}
                <Divider />
                <FormLayout>
                  <TextField label="Add a comment" value={newComment} onChange={setNewComment} multiline={3} autoComplete="off" />
                  <InlineStack gap="300" blockAlign="center">
                    <Button onClick={() => {
                      if (!newComment.trim()) return;
                      fetcher.submit({
                        intent: "add_comment",
                        comment: newComment,
                        visibleToTeacher: commentVisible.toString(),
                      }, { method: "POST" });
                      setNewComment("");
                    }}>Add Comment</Button>
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
            {/* Teacher Info */}
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Teacher</Text>
                <Divider />
                <Text as="p" variant="bodyMd" fontWeight="bold">
                  {offering.faculty?.fullName || offering.faculty?.publicName || "-"}
                </Text>
                <Text as="p" variant="bodySm">{offering.faculty?.email}</Text>
                <Button variant="plain" onClick={() => navigate(`/app/faculty/${offering.faculty?.id}`)}>
                  View profile
                </Button>
              </BlockStack>
            </Card>

            {/* Shopify Sync */}
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Shopify Sync</Text>
                <Divider />
                {offering.syncShopify?.length > 0 ? (
                  <BlockStack gap="200">
                    {offering.syncShopify.map((s: any) => (
                      <Box key={s.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm">{s.shopifyObjectType}</Text>
                            {syncStatusBadge(s.syncStatus)}
                          </InlineStack>
                          {s.shopifyObjectId && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              ID: {s.shopifyObjectId}
                            </Text>
                          )}
                          {s.lastSyncedAt && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              Synced: {new Date(s.lastSyncedAt).toLocaleString()}
                            </Text>
                          )}
                          {s.lastError && (
                            <Text as="span" variant="bodySm" tone="critical">{s.lastError}</Text>
                          )}
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">Not synced to Shopify yet.</Text>
                )}
              </BlockStack>
            </Card>

            {/* Timestamps */}
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Timeline</Text>
                <Divider />
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">Created:</Text>
                  <Text as="span" variant="bodySm">{new Date(offering.createdAt).toLocaleString()}</Text>
                </InlineStack>
                {offering.submittedAt && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">Submitted:</Text>
                    <Text as="span" variant="bodySm">{new Date(offering.submittedAt).toLocaleString()}</Text>
                  </InlineStack>
                )}
                {offering.approvedAt && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">Approved:</Text>
                    <Text as="span" variant="bodySm">{new Date(offering.approvedAt).toLocaleString()}</Text>
                  </InlineStack>
                )}
                {offering.publishedAt && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">Published:</Text>
                    <Text as="span" variant="bodySm">{new Date(offering.publishedAt).toLocaleString()}</Text>
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setModalNotes(""); }}
        title="Reject Offering"
        primaryAction={{
          content: "Reject",
          destructive: true,
          onAction: () => {
            if (!modalNotes.trim()) return;
            fetcher.submit({ intent: "reject", notes: modalNotes }, { method: "POST" });
            setRejectModalOpen(false);
            setModalNotes("");
          },
          disabled: !modalNotes.trim(),
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => { setRejectModalOpen(false); setModalNotes(""); } }]}
      >
        <Modal.Section>
          <TextField label="Rejection reason" value={modalNotes} onChange={setModalNotes} multiline={4} autoComplete="off" placeholder="Reason for rejection..." />
        </Modal.Section>
      </Modal>

      {/* Request Changes Modal */}
      <Modal
        open={changesModalOpen}
        onClose={() => { setChangesModalOpen(false); setModalNotes(""); }}
        title="Request Changes"
        primaryAction={{
          content: "Send Feedback",
          onAction: () => {
            if (!modalNotes.trim()) return;
            fetcher.submit({ intent: "request_changes", notes: modalNotes }, { method: "POST" });
            setChangesModalOpen(false);
            setModalNotes("");
          },
          disabled: !modalNotes.trim(),
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => { setChangesModalOpen(false); setModalNotes(""); } }]}
      >
        <Modal.Section>
          <TextField label="What changes are needed?" value={modalNotes} onChange={setModalNotes} multiline={4} autoComplete="off" />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
