"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  UserPlus,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import type { UserRow } from "../actions";
import { AddUserModal } from "./add-user-modal";

export type { UserRow };

type Props = {
  rows: UserRow[];
  canAddUser: boolean;
  designations: { id: number; name: string }[];
  branches: { id: number; name: string }[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const { id, name, email } = row.original;
      const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      return (
        <Link
          href={`/users/${id}`}
          className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-brand text-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="font-medium underline group-hover:font-bold text-foreground truncate transition-all">
              {name}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {email}
            </div>
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "employeeCode",
    header: "Employee Code",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground text-xs font-mono">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    filterFn: (row, id, value) => !value || row.getValue(id) === value,
    cell: ({ getValue }) => (
      <span className="inline-flex text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
        {getValue<string>() === "F" ? "Full-time" : "Trainee"}
      </span>
    ),
  },
  {
    accessorKey: "branch",
    header: "Branch",
    filterFn: (row, id, value) => !value || row.getValue(id) === value,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    accessorKey: "designation",
    header: "Designation",
    cell: ({ getValue }) => (
      <span className="text-foreground">{getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => row.isActive,
    header: "Status",
    enableSorting: false,
    filterFn: (row, id, value) => {
      if (!value) return true;
      const active = row.getValue<boolean>(id);
      return value === "active" ? active : !active;
    },
    cell: ({ getValue }) => {
      const active = getValue<boolean>();
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
            active
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-500" : "bg-muted-foreground",
            )}
          />
          {active ? "Active" : "Inactive"}
        </span>
      );
    },
  },
];

export function UsersTable({ rows, canAddUser, designations, branches }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [showAddModal, setShowAddModal] = useState(false);

  const uniqueBranches = useMemo(
    () => [...new Set(rows.map((r) => r.branch).filter(Boolean) as string[])].sort(),
    [rows],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase();
      const { name, email, employeeCode, designation, branch } = row.original;
      return [name, email, employeeCode, designation ?? "", branch ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalRows);
  const pageCount = table.getPageCount();

  return (
    <>
      <Card>
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="text-lg font-semibold">All Users</CardTitle>
          <CardDescription>
            {table.getFilteredRowModel().rows.length}{" "}
            {table.getFilteredRowModel().rows.length === 1 ? "user" : "users"} found
          </CardDescription>
          {canAddUser && (
            <CardAction>
              <Button
                onClick={() => setShowAddModal(true)}
                className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-4"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className="space-y-4 px-4 md:px-6">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search by name, code, designation…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-full bg-muted border border-border focus:outline-none focus:border-ring transition"
              />
            </div>
            <FilterSelect
              label="Type"
              value={(table.getColumn("type")?.getFilterValue() as string) ?? ""}
              onChange={(v) => table.getColumn("type")?.setFilterValue(v || undefined)}
              options={[
                { label: "All Types", value: "" },
                { label: "Full-time", value: "F" },
                { label: "Trainee", value: "T" },
              ]}
            />
            <FilterSelect
              label="Branch"
              value={(table.getColumn("branch")?.getFilterValue() as string) ?? ""}
              onChange={(v) => table.getColumn("branch")?.setFilterValue(v || undefined)}
              options={[
                { label: "All Branches", value: "" },
                ...uniqueBranches.map((b) => ({ label: b, value: b })),
              ]}
            />
            <FilterSelect
              label="Status"
              value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
              onChange={(v) => table.getColumn("status")?.setFilterValue(v || undefined)}
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
            />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                        >
                          {header.column.getCanSort() ? (
                            <Button
                              variant="ghost"
                              onClick={header.column.getToggleSortingHandler()}
                              className="h-auto p-0 gap-1 font-medium text-muted-foreground hover:text-foreground hover:bg-transparent uppercase tracking-wide text-xs"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {
                                {
                                  asc: <ArrowUp className="h-3 w-3" />,
                                  desc: <ArrowDown className="h-3 w-3" />,
                                }[header.column.getIsSorted() as string] ?? (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )
                              }
                            </Button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-border">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-muted-foreground text-sm"
                      >
                        No users match your filters.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination footer */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted border-t border-border flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger size="sm" className="h-7 w-auto text-xs rounded-lg border-border px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PAGE_SIZE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <span className="ml-1">{start}–{end} of {totalRows}</span>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-7" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="size-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                {Array.from({ length: pageCount }, (_, i) => i)
                  .filter((i) => Math.abs(i - pageIndex) <= 2)
                  .map((i) => (
                    <Button
                      key={i}
                      variant={i === pageIndex ? "default" : "outline"}
                      size="icon"
                      className="size-7 text-xs"
                      onClick={() => table.setPageIndex(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                <Button variant="outline" size="icon" className="size-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="size-7" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          designations={designations}
          branches={branches}
        />
      )}
    </>
  );
}

// Uses sentinel "__all__" because Radix Select doesn't support empty string values
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const SENTINEL = "__all__";
  const selectValue = value || SENTINEL;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === SENTINEL ? "" : v)}
      >
        <SelectTrigger size="sm" className="h-8 text-xs rounded-full border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value || SENTINEL} value={o.value || SENTINEL}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
