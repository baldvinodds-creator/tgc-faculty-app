import { useState, useCallback } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  IndexTable,
  TextField,
  Select,
  EmptyState,
  BlockStack,
  InlineStack,
  Pagination,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DIVISIONS = [
  { label: "All Divisions", value: "" },
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
];

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Active", value: "active" },
  { label: "Approved", value: "approved" },
  { label: "Applicant", value: "applicant" },
  { label: "Pending Review", value: "pending_review" },
  { label: "Changes Requested", value: "changes_requested" },
  { label: "Paused", value: "paused" },
  { label: "Suspended", value: "suspended" },
  { label: "Archived", value: "archived" },
  { label: "Rejected", value: "rejected" },
];

const PAGE_SIZE = 25;

function facultyStatusBadge(status: string) {
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const division = url.searchParams.get("division") || "";
  const instrument = url.searchParams.get("instrument") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  try {
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { publicName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.status = status;
    if (division) where.division = division;
    if (instrument) {
      where.primaryInstrument = { contains: instrument, mode: "insensitive" };
    }

    const [faculty, total] = await Promise.all([
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
          updatedAt: true,
          _count: {
            select: { offerings: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip,
      }),
      prisma.faculty.count({ where }),
    ]);

    return json({
      faculty,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Faculty list error:", error);
    return json({
      faculty: [],
      total: 0,
      page: 1,
      totalPages: 0,
      error: "Failed to load faculty",
    });
  }
};

export default function FacultyPage() {
  const { faculty, total, page, totalPages } = useLoaderData<typeof loader>() as any;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [divisionFilter, setDivisionFilter] = useState(searchParams.get("division") || "");
  const [instrumentFilter, setInstrumentFilter] = useState(searchParams.get("instrument") || "");

  const applyFilters = useCallback(() => {
    const params: Record<string, string> = {};
    if (searchValue) params.search = searchValue;
    if (statusFilter) params.status = statusFilter;
    if (divisionFilter) params.division = divisionFilter;
    if (instrumentFilter) params.instrument = instrumentFilter;
    setSearchParams(params);
  }, [searchValue, statusFilter, divisionFilter, instrumentFilter, setSearchParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") applyFilters();
    },
    [applyFilters],
  );

  const clearFilters = useCallback(() => {
    setSearchValue("");
    setStatusFilter("");
    setDivisionFilter("");
    setInstrumentFilter("");
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

  const resourceName = { singular: "faculty member", plural: "faculty members" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(faculty);

  const rowMarkup = faculty.map((f: any, index: number) => (
    <IndexTable.Row
      id={f.id}
      key={f.id}
      position={index}
      selected={selectedResources.includes(f.id)}
      onClick={() => navigate(`/app/faculty/${f.id}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {f.fullName || f.publicName || "Unnamed"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{f.email}</IndexTable.Cell>
      <IndexTable.Cell>{facultyStatusBadge(f.status)}</IndexTable.Cell>
      <IndexTable.Cell>{f.division || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{f.primaryInstrument || "-"}</IndexTable.Cell>
      <IndexTable.Cell>{f._count?.offerings ?? 0}</IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(f.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Faculty Management"
      backAction={{ content: "Dashboard", url: "/app" }}
      subtitle={`${total} total members`}
    >
      <TitleBar title="Faculty Management" />
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <div style={{ padding: "16px" }}>
              <BlockStack gap="300">
                <TextField
                  label=""
                  labelHidden
                  placeholder="Search by name or email..."
                  value={searchValue}
                  onChange={setSearchValue}
                  onBlur={applyFilters}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => {
                    setSearchValue("");
                    const params = new URLSearchParams(searchParams);
                    params.delete("search");
                    setSearchParams(params);
                  }}
                />
                <InlineStack gap="300">
                  <div style={{ width: "200px" }}>
                    <Select
                      label=""
                      labelHidden
                      options={STATUS_OPTIONS}
                      value={statusFilter}
                      onChange={(v) => {
                        setStatusFilter(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("status", v);
                        else params.delete("status");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                    />
                  </div>
                  <div style={{ width: "200px" }}>
                    <Select
                      label=""
                      labelHidden
                      options={DIVISIONS}
                      value={divisionFilter}
                      onChange={(v) => {
                        setDivisionFilter(v);
                        const params = new URLSearchParams(searchParams);
                        if (v) params.set("division", v);
                        else params.delete("division");
                        params.delete("page");
                        setSearchParams(params);
                      }}
                    />
                  </div>
                  {(statusFilter || divisionFilter || searchValue) && (
                    <Button variant="plain" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </div>

            {faculty.length === 0 ? (
              <div style={{ padding: "16px" }}>
                <EmptyState
                  heading="No faculty found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try adjusting your search or filters.</p>
                </EmptyState>
              </div>
            ) : (
              <>
                <IndexTable
                  resourceName={resourceName}
                  itemCount={faculty.length}
                  selectedItemsCount={
                    allResourcesSelected ? "All" : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: "Name" },
                    { title: "Email" },
                    { title: "Status" },
                    { title: "Division" },
                    { title: "Instrument" },
                    { title: "Offerings" },
                    { title: "Last Active" },
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

