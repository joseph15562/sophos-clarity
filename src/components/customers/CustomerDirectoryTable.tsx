import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { CustomerDirectoryEntry } from "@/lib/customer-directory";
import {
  customerCrmStatus,
  customerOpenAlerts,
  customerInitials,
  avatarHueFromName,
} from "@/lib/customer-ui-helpers";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Eye, Send, Settings } from "lucide-react";

const columnHelper = createColumnHelper<CustomerDirectoryEntry>();

export function CustomerDirectoryTable({
  data,
  onView,
  onManage,
}: {
  data: CustomerDirectoryEntry[];
  onView: (c: CustomerDirectoryEntry) => void;
  onManage: (c: CustomerDirectoryEntry) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 gap-1 px-2 text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Customer
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          </Button>
        ),
        cell: ({ row }) => {
          const c = row.original;
          const hue = avatarHueFromName(c.name);
          return (
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
              >
                {customerInitials(c.name)}
              </div>
              <span className="font-medium text-foreground">{c.name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("sector", {
        header: "Industry",
        cell: (info) => <span className="text-muted-foreground text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor("score", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 gap-1 px-2 text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Score
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          </Button>
        ),
        cell: (info) => (
          <span className="tabular-nums font-semibold text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "alerts",
        header: "Open alerts",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{customerOpenAlerts(row.original)}</span>
        ),
      }),
      columnHelper.accessor("firewallCount", {
        header: "Devices",
        cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      }),
      columnHelper.accessor("lastAssessed", {
        header: "Last report",
        cell: (info) => <span className="text-xs text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = customerCrmStatus(row.original);
          return (
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                s === "Active" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
                s === "Onboarding" && "border-blue-500/30 bg-blue-500/10 text-blue-600",
                s === "Churned" && "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              {s}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => onView(c)}
              >
                <Eye className="h-3 w-3" />
                View
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                <Link to={`/?${new URLSearchParams({ customer: c.name }).toString()}`}>
                  <Send className="h-3 w-3" />
                  Assess
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => onManage(c)}
              >
                <Settings className="h-3 w-3" />
                Manage
              </Button>
            </div>
          );
        },
      }),
    ],
    [onView, onManage],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/50 overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent border-border/60">
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="text-[11px] uppercase tracking-wider">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center text-muted-foreground py-10"
              >
                No customers in this view.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="border-border/50 hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
