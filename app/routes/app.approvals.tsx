import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
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
  IndexTable,
  Tabs,
  EmptyState,
  Box,
  Divider,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const TABS = [
  { id: "pending", content: "Pending" },
  { id: "all", content: "All" },
  { id: "approved", content: "Approved" },
  { id: "rejected", content: "Rejected" },
];

function statusBadge(status: string) {
  const map: Record<string, any> = {
    pending: "attention",
    pending_approval: "attention",
    approved: "success",
    rejected: "critical",
    changes_requested: "warning",
  };
  return (
    <Badge tone={map[status]}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "pending";

  try {
    // Fetch pending offering edits
    const offeringEditWhere: Record<string, unknown> = {};
    const profileEditWhere: Record<string, unknown> = {};

    if (tab === "pending") {
      offeringEditWhere.status = "pending_approval";
      profileEditWhere.status = "pending_approval";
    } else if (tab === "approved") {
      offeringEditWhere.status = "approved";
      profileEditWhere.status = "approved";
    } else if (tab === "rejected") {
      offeringEditWhere.status = "rejected";
      profileEditWhere.status = "rejected";
    }

    const [offeringEdits, profileEdits, pendingOfferings] = await Promise.all([
      prisma.offeringEdit.findMany({
        where: offeringEditWhere,
        include: {
          offering: {
            select: { id: true, title: true, facultyId: true, faculty: { select: { fullName: true, email: true } } },
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.profileEdit.findMany({
        where: profileEditWhere,
        include: {
          faculty: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),
      tab === "pending"
        ? prisma.offering.findMany({
            where: { status: "pending_approval" },
            include: { faculty: { select: { id: true, fullName: true, email: true } } },
            orderBy: { submittedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    return json({ offeringEdits, profileEdits, pendingOfferings, tab });
  } catch (error) {
    console.error("Approvals loader error:", error);
    return json({ offeringEdits: [], profileEdits: [], pendingOfferings: [], tab, error: "Failed to load" });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const editId = formData.get("editId") as string;
    const editType = formData.get("editType") as string; // offering_edit | profile_edit

    if (intent === "approve_edit") {
      if (editType === "offering_edit") {
        const edit = await prisma.offeringEdit.findUnique({ where: { id: editId } });
        if (!edit) return json({ error: "Edit not found" }, { status: 404 });

        const changes = edit.changes as Record<string, any>;
        await prisma.$transaction([
          prisma.offering.update({ where: { id: edit.offeringId }, data: changes }),
          prisma.offeringEdit.update({
            where: { id: editId },
            data: { status: "approved", reviewedAt: new Date(), reviewerId: session.id },
          }),
          prisma.auditLog.create({
            data: {
              actorType: "admin", actorId: session.id,
              action: "offering_edit.approved", objectType: "offering_edit", objectId: editId,
            },
          }),
        ]);
      } else {
        const edit = await prisma.profileEdit.findUnique({ where: { id: editId } });
        if (!edit) return json({ error: "Edit not found" }, { status: 404 });

        const changes = edit.changes as Record<string, any>;
        await prisma.$transaction([
          prisma.faculty.update({ where: { id: edit.facultyId }, data: changes }),
          prisma.profileEdit.update({
            where: { id: editId },
            data: { status: "approved", reviewedAt: new Date(), reviewerId: session.id },
          }),
          prisma.auditLog.create({
            data: {
              actorType: "admin", actorId: session.id,
              action: "profile_edit.approved", objectType: "profile_edit", objectId: editId,
            },
          }),
        ]);
      }
      return json({ success: true, message: "Edit approved" });
    }

    if (intent === "reject_edit") {
      if (editType === "offering_edit") {
        await prisma.$transaction([
          prisma.offeringEdit.update({
            where: { id: editId },
            data: { status: "rejected", reviewedAt: new Date(), reviewerId: session.id },
          }),
          prisma.auditLog.create({
            data: {
              actorType: "admin", actorId: session.id,
              action: "offering_edit.rejected", objectType: "offering_edit", objectId: editId,
            },
          }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.profileEdit.update({
            where: { id: editId },
            data: { status: "rejected", reviewedAt: new Date(), reviewerId: session.id },
          }),
          prisma.auditLog.create({
            data: {
              actorType: "admin", actorId: session.id,
              action: "profile_edit.rejected", objectType: "profile_edit", objectId: editId,
            },
          }),
        ]);
      }
      return json({ success: true, message: "Edit rejected" });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Approvals action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

export default function ApprovalsPage() {
  const { offeringEdits, profileEdits, pendingOfferings, tab } =
    useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTab = TABS.findIndex((t) => t.id === (tab || "pending"));
  const actionData = fetcher.data as any;
  const isSubmitting = fetcher.state !== "idle";

  const handleTabChange = useCallback(
    (index: number) => {
      setSearchParams({ tab: TABS[index].id });
    },
    [setSearchParams],
  );

  const totalItems =
    offeringEdits.length + profileEdits.length + (pendingOfferings?.length || 0);

  return (
    <Page
      title="Approvals Queue"
      backAction={{ content: "Dashboard", url: "/app" }}
      subtitle={`${totalItems} item(s)`}
    >
      <TitleBar title="Approvals Queue" />
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

        <Tabs tabs={TABS} selected={selectedTab >= 0 ? selectedTab : 0} onSelect={handleTabChange}>
          <BlockStack gap="500">
            {/* Pending Offerings */}
            {pendingOfferings?.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Pending Offering Submissions ({pendingOfferings.length})
                  </Text>
                  <Divider />
                  {pendingOfferings.map((o: any) => (
                    <Box key={o.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="bold">
                            {o.title || "Untitled"}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            by {o.faculty?.fullName || o.faculty?.email} -- {o.offeringType?.replace(/_/g, " ")}
                          </Text>
                        </BlockStack>
                        <Button size="slim" onClick={() => navigate(`/app/offerings/${o.id}`)}>
                          Review
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Offering Edits */}
            {offeringEdits.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Offering Edits ({offeringEdits.length})
                  </Text>
                  <Divider />
                  {offeringEdits.map((edit: any) => (
                    <Box key={edit.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodyMd" fontWeight="bold">
                              {edit.offering?.title || "Untitled Offering"}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              by {edit.offering?.faculty?.fullName || edit.offering?.faculty?.email}
                            </Text>
                          </BlockStack>
                          {statusBadge(edit.status)}
                        </InlineStack>
                        <BlockStack gap="100">
                          {Object.entries(edit.changes as Record<string, any>).map(([field, val]) => (
                            <InlineStack key={field} gap="200">
                              <Text as="span" variant="bodySm" fontWeight="semibold">{field}:</Text>
                              <Text as="span" variant="bodySm">{String(val)}</Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          Submitted {new Date(edit.submittedAt).toLocaleDateString()}
                        </Text>
                        {edit.status === "pending_approval" && (
                          <InlineStack gap="200">
                            <Button size="slim" variant="primary" loading={isSubmitting} onClick={() =>
                              fetcher.submit({ intent: "approve_edit", editId: edit.id, editType: "offering_edit" }, { method: "POST" })
                            }>Approve</Button>
                            <Button size="slim" tone="critical" loading={isSubmitting} onClick={() =>
                              fetcher.submit({ intent: "reject_edit", editId: edit.id, editType: "offering_edit" }, { method: "POST" })
                            }>Reject</Button>
                            <Button size="slim" variant="plain" onClick={() => navigate(`/app/offerings/${edit.offering?.id}`)}>
                              View Offering
                            </Button>
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Profile Edits */}
            {profileEdits.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Profile Edits ({profileEdits.length})
                  </Text>
                  <Divider />
                  {profileEdits.map((edit: any) => (
                    <Box key={edit.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodyMd" fontWeight="bold">
                              {edit.faculty?.fullName || edit.faculty?.email || "Unknown"}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">Profile update</Text>
                          </BlockStack>
                          {statusBadge(edit.status)}
                        </InlineStack>
                        <BlockStack gap="100">
                          {Object.entries(edit.changes as Record<string, any>).map(([field, val]) => (
                            <InlineStack key={field} gap="200">
                              <Text as="span" variant="bodySm" fontWeight="semibold">{field}:</Text>
                              <Text as="span" variant="bodySm">{String(val)}</Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          Submitted {new Date(edit.submittedAt).toLocaleDateString()}
                        </Text>
                        {edit.status === "pending_approval" && (
                          <InlineStack gap="200">
                            <Button size="slim" variant="primary" loading={isSubmitting} onClick={() =>
                              fetcher.submit({ intent: "approve_edit", editId: edit.id, editType: "profile_edit" }, { method: "POST" })
                            }>Approve</Button>
                            <Button size="slim" tone="critical" loading={isSubmitting} onClick={() =>
                              fetcher.submit({ intent: "reject_edit", editId: edit.id, editType: "profile_edit" }, { method: "POST" })
                            }>Reject</Button>
                            <Button size="slim" variant="plain" onClick={() => navigate(`/app/faculty/${edit.faculty?.id}`)}>
                              View Profile
                            </Button>
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>
            )}

            {totalItems === 0 && (
              <Card>
                <EmptyState
                  heading="No items to review"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>All approvals are up to date.</p>
                </EmptyState>
              </Card>
            )}
          </BlockStack>
        </Tabs>
      </BlockStack>
    </Page>
  );
}
