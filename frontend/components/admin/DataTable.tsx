"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowsDownUp, CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Text search across these accessor values. */
  searchPlaceholder?: string;
  initialSearch?: string;
  globalFilterFn?: (row: T, query: string) => boolean;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  bulkActions?: (rows: T[], table: TanTable<T>) => React.ReactNode;
  pageSize?: number;
  emptyText?: string;
  getRowId?: (row: T) => string;
};

export function selectColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    size: 36,
  };
}

export function SortHeader({ label, column }: { label: string; column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void } }) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-ink"
    >
      {label}
      {sorted === "asc" ? <ArrowUp size={12} /> : sorted === "desc" ? <ArrowDown size={12} /> : <ArrowsDownUp size={12} className="opacity-50" />}
    </button>
  );
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder,
  initialSearch = "",
  globalFilterFn,
  toolbar,
  onRowClick,
  selectable = false,
  bulkActions,
  pageSize = 12,
  emptyText = "Nothing here yet.",
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages its own memoisation
  const table = useReactTable({
    data,
    columns: selectable ? [selectColumn<T>(), ...columns] : columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
    getRowId,
    globalFilterFn: globalFilterFn
      ? (row: Row<T>, _id, value: string) => globalFilterFn(row.original, String(value).toLowerCase())
      : "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3">
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {searchPlaceholder && (
            <label className="relative block lg:w-72">
              <span className="sr-only">{searchPlaceholder}</span>
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 bg-surface pl-9"
              />
            </label>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{toolbar}</div>}
        </div>
      )}

      {selectable && selected.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-[13px]">
          <span className="font-medium text-ink">{selected.length} selected</span>
          <span className="mx-1 h-4 w-px bg-line" />
          {bulkActions(selected, table)}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => table.resetRowSelection()}>
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.column.columnDef.size !== 150 ? h.column.columnDef.size : undefined }} className="h-10 text-[12px] font-medium text-subtle">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getAllColumns().length} className="h-32 text-center text-[14px] text-subtle">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 text-[13px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 text-[13px] text-subtle">
        <p>
          {total === 0 ? "No results" : `Showing ${from} to ${to} of ${total}`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <CaretLeft />
          </Button>
          <span className="px-2 tabular-nums">
            {table.getPageCount() === 0 ? 0 : pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <CaretRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
