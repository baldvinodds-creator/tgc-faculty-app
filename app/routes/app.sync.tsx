import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
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
  Modal,
  Box,
  Divider,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "synced", content: "Synced" },
  { id: "failed", content: "Failed" },
  { id: "pending", content: "Pending" },
  { id: "needs_update", content: "Needs Update" },
];

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.syncStatus = status;
    }

    const syncs = await prisma.syncShopify.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    // Get faculty/offering names for display
    const objectIds = [...new Set(syncs.map((s) => s.objectId))];

    const [faculties, offerings] = await Promise.all([
      prisma.faculty.findMany({
        where: { id: { in: objectIds } },
        select: { id: true, fullName: true, publicName: true, email: true },
      }),
      prisma.offering.findMany({
        where: { id: { in: objectIds } },
        select: { id: true, title: true },
      }),
    ]);

    const nameMap: Record<string, string> = {};
    faculties.forEach((f) => {
      nameMap[f.id] = f.fullName || f.publicName || f.email;
    });
    offerings.forEach((o) => {
      nameMap[o.id] = o.title || "Untitled Offering";
    });

    const failedCount = syncs.filter((s) => s.syncStatus === "failed").length;

    return json({ syncs, nameMap, failedCount });
  } catch (error) {
    console.error("Sync status error:", error);
    return json({ syncs: [], nameMap: {}, failedCount: 0, error: "Failed to load sync data" });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "retry") {
      const syncId = formData.get("syncId") as string;
      await prisma.syncShopify.update({
        where: { id: syncId },
        data: {
          syncStatus: "pending",
          lastError: null,
          retryCount: { increment: 1 },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "sync.retry",
          objectType: "sync_shopify",
          objectId: syncId,
        },
      });

      return json({ success: true, message: "Sync retry queued" });
    }

    if (intent === "retry_all_failed") {
      const result = await prisma.syncShopify.updateMany({
        where: { syncStatus: "failed" },
        data: {
          syncStatus: "pending",
          lastError: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          actorId: session.id,
          action: "sync.retry_all_failed",
          objectType: "sync_shopify",
          details: { count: result.count },
        },
      });

      return json({ success: true, message: `${result.count} sync(s) queued for retry` });
    }

    return json({ error: "Unknown intent" }, { status: 400 });
  } catch (error) {
    console.error("Sync action error:", error);
    return json({ error: "Action failed" }, { status: 500 });
  }
};

export default function SyncStatusPage() {
  const { syncs, nameMap, failedCount } = useLoaderData<typeof loader>() as any;
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const selectedTab = STATUS_TABS.findIndex((t) => t.id === currentStatus);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSync, setSelectedSync] = useState<any>(null);

  const actionData = fetcher.data as any;
  const isSubmitting = fetcher.state !== "idle";

  const handleTabChange = useCallback(
    (index: number) => {
      const tab = STATUS_TABS[index];
      if (tab.id === "all") {
        setSearchParams({});
      } else {
        setSearchParams({ status: tab.id });
      }
    },
    [setSearchParams],
  );

  const resourceName = { singular: "sync record", plural: "sync records" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(syncs);

  const rowMarkup = syncs.map((s: any, index: number) => (
    <IndexTable.Row
      id={s.id}
      key={s.id}
      position={index}
      selected={selectedResources.includes(s.id)}
      onClick={() => {
        setSelectedSync(s);
        setDetailModalOpen(true);
      }}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {s.objectType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {nameMap[s.objectId] || s.objectId.substring(0, 8) + "..."}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {s.shopifyObjectType.replace(/\b\w/g, (c: string) => c.toUpperCase())}
      </IndexTable.Cell>
      <IndexTable.Cell>{syncStatusBadge(s.syncStatus)}</IndexTable.Cell>
      <IndexTable.Cell>
        {s.lastSyncedAt
          ? new Date(s.lastSyncedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone={s.lastError ? "critical" : "subdued"}>
          {s.lastError ? s.lastError.substring(0, 60) + (s.lastError.length > 60 ? "..." : "") : "-"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {s.syncStatus === "failed" && (
          <Button
            size="slim"
            onClick={(e: any) => {
              e?.stopPropagation?.();
              fetcher.submit({ intent: "retry", syncId: s.id }, { method: "POST" });
            }}
            loading={isSubmitting}
          >
            Retry
          </Button>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Sync Status"
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={
        failedCount > 0
          ? {
              content: `Retry All Failed (${failedCount})`,
              onAction: () =>
                fetcher.submit({ intent: "retry_all_failed" }, { method: "POST" }),
              loading: isSubmitting,
              tone: "critical" as any,
            }
          : undefined
      }
    >
      <TitleBar title="Sync Status" />
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

        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Tabs
                tabs={STATUS_TABS}
                selected={selectedTab >= 0 ? selectedTab : 0}
                onSelect={handleTabChange}
              >
                {syncs.length === 0 ? (
                  <div style={{ padding: "16px" }}>
                    <EmptyState
                      heading="No sync records"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        {currentStatus !== "all"
                          ? `No sync records with status "${currentStatus.replace(/_/g, " ")}".`
                          : "No Shopify sync records exist yet."}
                      </p>
                    </EmptyState>
                  </div>
                ) : (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={syncs.length}
                    selectedItemsCount={
                      allResourcesSelected ? "All" : selectedResources.length
                    }
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: "Object Type" },
                      { title: "Name" },
                      { title: "Shopify Type" },
                      { title: "Status" },
                      { title: "Last Synced" },
                      { title: "Error" },
                      { title: "" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                )}
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedSync(null);
        }}
        title="Sync Record Details"
        secondaryActions={[
          {
            content: "Close",
            onAction: () => {
              setDetailModalOpen(false);
              setSelectedSync(null);
            },
          },
        ]}
      >
        <Modal.Section>
          {selectedSync && (
            <BlockStack gap="300">
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">ID:</Text>
                <Text as="span" variant="bodySm">{selectedSync.id}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Object Type:</Text>
                <Text as="span" variant="bodySm">{selectedSync.objectType}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Object ID:</Text>
                <Text as="span" variant="bodySm">{selectedSync.objectId}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Shopify Type:</Text>
                <Text as="span" variant="bodySm">{selectedSync.shopifyObjectType}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Shopify ID:</Text>
                <Text as="span" variant="bodySm">{selectedSync.shopifyObjectId || "-"}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Handle:</Text>
                <Text as="span" variant="bodySm">{selectedSync.shopifyHandle || "-"}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Status:</Text>
                {syncStatusBadge(selectedSync.syncStatus)}
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" fontWeight="semibold">Retry Count:</Text>
                <Text as="span" variant="bodySm">{selectedSync.retryCount}</Text>
              </InlineStack>
              {selectedSync.lastError && (
                <>
                  <Divider />
                  <Text as="p" variant="bodySm" fontWeight="semibold">Error:</Text>
                  <Box padding="200" background="bg-surface-critical" borderRadius="200">
                    <Text as="p" variant="bodySm">{selectedSync.lastError}</Text>
                  </Box>
                </>
              )}
              {selectedSync.syncSteps && (
                <>
                  <Divider />
                  <Text as="p" variant="bodySm" fontWeight="semibold">Sync Steps:</Text>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <pre style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(selectedSync.syncSteps, null, 2)}
                    </pre>
                  </Box>
                </>
              )}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
