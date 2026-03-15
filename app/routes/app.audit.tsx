import { useState, useCallback } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  IndexTable,
  Select,
  TextField,
  EmptyState,
  Box,
  Pagination,
  Divider,
  Collapsible,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 50;

const ACTOR_TYPES = [
  { label: "All Actors", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Teacher", value: "teacher" },
  { label: "System", value: "system" },
];

const OBJECT_TYPES = [
  { label: "All Objects", value: "" },
  { label: "Faculty", value: "faculty" },
  { label: "Faculty Application", value: "faculty_application" },
  { label: "Offering", value: "offering" },
  { label: "Offering Edit", value: "offering_edit" },
  { label: "Profile Edit", value: "profile_edit" },
  { label: "Sync Shopify", value: "sync_shopify" },
  { label: "Payout", value: "payout" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const actorType = url.searchParams.get("actorType") || "";
  const objectType = url.searchParams.get("objectType") || "";
  const action = url.searchParams.get("action") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  try {
    const where: Record<string, unknown> = {};

    if (actorType) where.actorType = actorType;
    if (objectType) where.objectType = objectType;
    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo + "T23:59:59Z");
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Audit log error:", error);
    return json({ logs: [], total: 0, page: 1, totalPages: 0, error: "Failed to load audit log" });
  }
};

export default function AuditLogPage() {
  const { logs, total, page, totalPages } = useLoaderData<typeof loader>() as any;
  const [searchParams, setSearchParams] = useSearchParams();

  const [actorType, setActorType] = useState(searchParams.get("actorType") || "");
  const [objectType, setObjectType] = useState(searchParams.get("objectType") || "");
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const applyFilters = useCallback(() => {
    const params: Record<string, string> = {};
    if (actorType) params.actorType = actorType;
    if (objectType) params.objectType = objectType;
    if (actionFilter) params.action = actionFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    setSearchParams(params);
  }, [actorType, objectType, actionFilter, dateFrom, dateTo, setSearchParams]);

  const clearFilters = useCallback(() => {
    setActorType("");
    setObjectType("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchParams({});
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resourceName = { singular: "log entry", plural: "log entries" };

  const rowMarkup = logs.map((log: any, index: number) => (
    <IndexTable.Row
      id={log.id}
      key={log.id}
      position={index}
      onClick={() => toggleExpanded(log.id)}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {new Date(log.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={
            log.actorType === "admin"
              ? "info"
              : log.actorType === "system"
                ? "attention"
                : undefined
          }
        >
          {log.actorType}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" fontWeight="semibold">
          {log.action}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {log.objectType || "-"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {log.details ? (
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              {expandedRows.has(log.id)
                ? JSON.stringify(log.details, null, 2)
                : JSON.stringify(log.details).substring(0, 80) +
                  (JSON.stringify(log.details).length > 80 ? "..." : "")}
            </Text>
          </BlockStack>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">-</Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Audit Log"
      backAction={{ content: "Dashboard", url: "/app" }}
      subtitle={`${total} total entries`}
    >
      <TitleBar title="Audit Log" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {/* Filters */}
            <div style={{ padding: "16px" }}>
              <BlockStack gap="300">
                <InlineStack gap="300" wrap>
                  <div style={{ width: "180px" }}>
                    <Select
                      label=""
                      labelHidden
                      options={ACTOR_TYPES}
                      value={actorType}
                      onChange={(v) => {
                        setActorType(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("actorType", v);
                        else params.delete("actorType");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                    />
                  </div>
                  <div style={{ width: "200px" }}>
                    <Select
                      label=""
                      labelHidden
                      options={OBJECT_TYPES}
                      value={objectType}
                      onChange={(v) => {
                        setObjectType(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("objectType", v);
                        else params.delete("objectType");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                    />
                  </div>
                  <div style={{ width: "200px" }}>
                    <TextField
                      label=""
                      labelHidden
                      placeholder="Filter by action..."
                      value={actionFilter}
                      onChange={setActionFilter}
                      autoComplete="off"
                      onBlur={applyFilters}
                    />
                  </div>
                  <div style={{ width: "150px" }}>
                    <TextField
                      label=""
                      labelHidden
                      type="date"
                      value={dateFrom}
                      onChange={(v) => {
                        setDateFrom(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("dateFrom", v);
                        else params.delete("dateFrom");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                      autoComplete="off"
                      placeholder="From date"
                    />
                  </div>
                  <div style={{ width: "150px" }}>
                    <TextField
                      label=""
                      labelHidden
                      type="date"
                      value={dateTo}
                      onChange={(v) => {
                        setDateTo(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("dateTo", v);
                        else params.delete("dateTo");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                      autoComplete="off"
                      placeholder="To date"
                    />
                  </div>
                  {(actorType || objectType || actionFilter || dateFrom || dateTo) && (
                    <Button variant="plain" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: "16px" }}>
                <EmptyState
                  heading="No audit log entries"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No entries match your filters.</p>
                </EmptyState>
              </div>
            ) : (
              <>
                <IndexTable
                  resourceName={resourceName}
                  itemCount={logs.length}
                  headings={[
                    { title: "Timestamp" },
                    { title: "Actor" },
                    { title: "Action" },
                    { title: "Object" },
                    { title: "Details" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "16px",
                    }}
                  >
                    <Pagination
                      hasPrevious={page > 1}
                      hasNext={page < totalPages}
                      onPrevious={() => handlePageChange(page - 1)}
                      onNext={() => handlePageChange(page + 1)}
                    />
                  </div>
                )}
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
