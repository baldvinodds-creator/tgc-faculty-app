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
  Modal,
  Divider,
  Thumbnail,
  SkeletonPage,
  SkeletonBodyText,
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
    return json({ error: "Application ID is required" }, { status: 400 });
  }

  try {
    const applicationBase = await prisma.facultyApplication.findUnique({
      where: { id },
      include: {
        faculty: {
          include: {
            offerings: {
              select: { id: true, title: true, offeringType: true, status: true },
            },
          },
        },
      },
    });

    if (!applicationBase) {
      return json({ error: "Application not found", application: null }, { status: 404 });
    }

    const adminComments = await prisma.adminComment.findMany({
      where: { objectType: "faculty", objectId: applicationBase.faculty.id },
      orderBy: { createdAt: "desc" },
    });

    const application = {
      ...applicationBase,
      faculty: { ...applicationBase.faculty, adminComments },
    };

    return json({ application, error: null });
  } catch (error) {
    console.error("Application detail loader error:", error);
    return json({ error: "Failed to load application", application: null }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "Application ID is required" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "add_comment") {
      const comment = formData.get("comment") as string;
      const visibleToTeacher = formData.get("visibleToTeacher") === "true";

      if (!comment || comment.trim().length === 0) {
        return json({ error: "Comment is required" }, { status: 400 });
      }

      const application = await prisma.facultyApplication.findUnique({
        where: { id },
        select: { facultyId: true },
      });

      if (!application) {
        return json({ error: "Application not found" }, { status: 404 });
      }

      await prisma.adminComment.create({
        data: {
          objectType: "faculty",
          objectId: application.facultyId,
          authorId: session.id,
          comment: comment.trim(),
          visibleToTeacher,
        },
      });

      return json({ success: true, message: "Comment added" });
    }

    if (intent === "approve") {
      await prisma.$transaction(async (tx) => {
        await tx.facultyApplication.update({
          where: { id },
          data: {
            status: "approved",
            reviewedAt: new Date(),
            reviewerId: session.id,
          },
        });

        const app = await tx.facultyApplication.findUnique({
          where: { id },
          select: { facultyId: true },
        });

        if (app) {
          await tx.faculty.update({
            where: { id: app.facultyId },
            data: { status: "approved" },
          });

          await tx.auditLog.create({
            data: {
              actorType: "admin",
              actorId: session.id,
              action: "application.approved",
              objectType: "faculty_application",
              objectId: id,
            },
          });
        }
      });

      return json({ success: true, message: "Application approved" });
    }

    if (intent === "reject") {
      const notes = formData.get("notes") as string;
      if (!notes || notes.trim().length === 0) {
        return json({ error: "Rejection notes are required" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.facultyApplication.update({
          where: { id },
          data: {
            status: "rejected",
            reviewedAt: new Date(),
            reviewerId: session.id,
            reviewNotes: notes.trim(),
          },
        });

        const app = await tx.facultyApplication.findUnique({
          where: { id },
          select: { facultyId: true },
        });

        if (app) {
          await tx.faculty.update({
            where: { id: app.facultyId },
            data: { status: "rejected" },
          });

          await tx.auditLog.create({
            data: {
              actorType: "admin",
              actorId: session.id,
              action: "application.rejected",
              objectType: "faculty_application",
              objectId: id,
              details: { notes: notes.trim() },
            },
          });
        }
      });

      return json({ success: true, message: "Application rejected" });
    }

    if (intent === "request_changes") {
      const notes = formData.get("notes") as string;
      if (!notes || notes.trim().length === 0) {
        return json({ error: "Change request feedback is required" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.facultyApplication.update({
          where: { id },
          data: {
            status: "changes_requested",
            reviewedAt: new Date(),
            reviewerId: session.id,
            reviewNotes: notes.trim(),
          },
        });

        const app = await tx.facultyApplication.findUnique({
          where: { id },
          select: { facultyId: true },
        });

        if (app) {
          await tx.faculty.update({
            where: { id: app.facultyId },
            data: { status: "changes_requested" },
          });

          await tx.auditLog.create({
            data: {
              actorType: "admin",
              actorId: session.id,
              action: "application.changes_requested",
              objectType: "faculty_application",
              objectId: id,
              details: { notes: notes.trim() },
            },
          });
        }
      });

      return json({ success: true, message: "Changes requested" });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Application action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

function statusBadge(status: string) {
  const map: Record<string, { tone: any; label: string }> = {
    pending_review: { tone: "attention", label: "Pending Review" },
    approved: { tone: "success", label: "Approved" },
    rejected: { tone: "critical", label: "Rejected" },
    changes_requested: { tone: "warning", label: "Changes Requested" },
  };
  const s = map[status] || { tone: undefined, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ApplicationDetailPage() {
  const { application, error } = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [modalNotes, setModalNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentVisible, setCommentVisible] = useState(true);

  const isSubmitting = fetcher.state !== "idle";
  const actionData = fetcher.data as any;

  if (error && !application) {
    return (
      <Page
        title="Application Not Found"
        backAction={{ content: "Applications", url: "/app/applications" }}
      >
        <Banner tone="critical">
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  if (!application) {
    return <SkeletonPage primaryAction />;
  }

  const faculty = application.faculty;
  const appData = application.applicationData || {};

  const handleApprove = () => {
    fetcher.submit(
      { intent: "approve" },
      { method: "POST" },
    );
  };

  const handleReject = () => {
    if (!modalNotes.trim()) return;
    fetcher.submit(
      { intent: "reject", notes: modalNotes },
      { method: "POST" },
    );
    setRejectModalOpen(false);
    setModalNotes("");
  };

  const handleRequestChanges = () => {
    if (!modalNotes.trim()) return;
    fetcher.submit(
      { intent: "request_changes", notes: modalNotes },
      { method: "POST" },
    );
    setChangesModalOpen(false);
    setModalNotes("");
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    fetcher.submit(
      {
        intent: "add_comment",
        comment: newComment,
        visibleToTeacher: commentVisible.toString(),
      },
      { method: "POST" },
    );
    setNewComment("");
  };

  return (
    <Page
      title={faculty?.fullName || "Application Detail"}
      subtitle={`Application submitted ${new Date(application.submittedAt).toLocaleDateString()}`}
      backAction={{ content: "Applications", url: "/app/applications" }}
      titleMetadata={statusBadge(application.status)}
    >
      <TitleBar title={faculty?.fullName || "Application Detail"} />
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

        {/* Action Buttons */}
        {application.status === "pending_review" && (
          <Card>
            <InlineStack gap="300">
              <Button
                variant="primary"
                tone="success"
                onClick={handleApprove}
                loading={isSubmitting}
              >
                Approve
              </Button>
              <Button
                tone="critical"
                onClick={() => setRejectModalOpen(true)}
                disabled={isSubmitting}
              >
                Reject
              </Button>
              <Button
                onClick={() => setChangesModalOpen(true)}
                disabled={isSubmitting}
              >
                Request Changes
              </Button>
            </InlineStack>
          </Card>
        )}

        <Layout>
          {/* Main Content */}
          <Layout.Section>
            {/* Application Data */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Application Data
                </Text>
                <Divider />
                {Object.keys(appData).length === 0 ? (
                  <Text as="p" tone="subdued">
                    No application data submitted.
                  </Text>
                ) : (
                  <BlockStack gap="300">
                    {Object.entries(appData).map(([key, value]) => (
                      <InlineStack key={key} gap="400" wrap={false}>
                        <Box minWidth="180px">
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {formatFieldName(key)}
                          </Text>
                        </Box>
                        <Text as="span" variant="bodySm">
                          {typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value || "-")}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Review Notes */}
            {application.reviewNotes && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Review Notes
                  </Text>
                  <Divider />
                  <Text as="p" variant="bodyMd">
                    {application.reviewNotes}
                  </Text>
                  {application.reviewedAt && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Reviewed on{" "}
                      {new Date(application.reviewedAt).toLocaleDateString()}
                    </Text>
                  )}
                </BlockStack>
              </Card>
            )}

            {/* Admin Comments */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Admin Notes
                </Text>
                <Divider />
                {faculty?.adminComments && faculty.adminComments.length > 0 ? (
                  <BlockStack gap="300">
                    {faculty.adminComments.map((c: any) => (
                      <Box
                        key={c.id}
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text as="span" variant="bodySm" fontWeight="semibold">
                              {c.authorId || "Admin"}
                            </Text>
                            <InlineStack gap="200">
                              {!c.visibleToTeacher && (
                                <Badge tone="info">Internal only</Badge>
                              )}
                              <Text as="span" variant="bodySm" tone="subdued">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </Text>
                            </InlineStack>
                          </InlineStack>
                          <Text as="p" variant="bodyMd">
                            {c.comment}
                          </Text>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    No admin notes yet.
                  </Text>
                )}

                <Divider />
                <FormLayout>
                  <TextField
                    label="Add a note"
                    value={newComment}
                    onChange={setNewComment}
                    multiline={3}
                    autoComplete="off"
                  />
                  <InlineStack gap="300" blockAlign="center">
                    <Button onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()} loading={isSubmitting}>
                      Add Note
                    </Button>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                      <input
                        type="checkbox"
                        checked={commentVisible}
                        onChange={(e) => setCommentVisible(e.target.checked)}
                      />
                      Visible to teacher
                    </label>
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            {/* Faculty Profile Summary */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Faculty Profile
                </Text>
                <Divider />
                {faculty?.headshotUrl && (
                  <Thumbnail
                    source={faculty.headshotUrl}
                    alt={faculty.fullName || "Headshot"}
                    size="large"
                  />
                )}
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Name:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {faculty?.fullName || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Email:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {faculty?.email || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Instrument:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {faculty?.primaryInstrument || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Division:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {faculty?.division || "-"}
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Status:
                    </Text>
                    <Badge>{faculty?.status || "-"}</Badge>
                  </InlineStack>
                </BlockStack>
                <Button
                  variant="plain"
                  onClick={() => navigate(`/app/faculty/${faculty?.id}`)}
                >
                  View full profile
                </Button>
              </BlockStack>
            </Card>

            {/* Application Meta */}
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Application Info
                </Text>
                <Divider />
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    ID:
                  </Text>
                  <Text as="span" variant="bodySm">
                    {application.id.substring(0, 8)}...
                  </Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    Submitted:
                  </Text>
                  <Text as="span" variant="bodySm">
                    {new Date(application.submittedAt).toLocaleString()}
                  </Text>
                </InlineStack>
                {application.reviewedAt && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Reviewed:
                    </Text>
                    <Text as="span" variant="bodySm">
                      {new Date(application.reviewedAt).toLocaleString()}
                    </Text>
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
        onClose={() => {
          setRejectModalOpen(false);
          setModalNotes("");
        }}
        title="Reject Application"
        primaryAction={{
          content: "Reject",
          destructive: true,
          onAction: handleReject,
          disabled: !modalNotes.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setRejectModalOpen(false);
              setModalNotes("");
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Rejection reason (will be shared with applicant)"
            value={modalNotes}
            onChange={setModalNotes}
            multiline={4}
            autoComplete="off"
            placeholder="Please provide a reason for rejection..."
          />
        </Modal.Section>
      </Modal>

      {/* Request Changes Modal */}
      <Modal
        open={changesModalOpen}
        onClose={() => {
          setChangesModalOpen(false);
          setModalNotes("");
        }}
        title="Request Changes"
        primaryAction={{
          content: "Send Feedback",
          onAction: handleRequestChanges,
          disabled: !modalNotes.trim(),
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setChangesModalOpen(false);
              setModalNotes("");
            },
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Feedback for the applicant"
            value={modalNotes}
            onChange={setModalNotes}
            multiline={4}
            autoComplete="off"
            placeholder="What changes are needed..."
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
