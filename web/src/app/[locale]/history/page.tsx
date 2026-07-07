"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJobs, deleteJob, type PaginatedJobs } from "@/lib/api";

const statusFilters = ["all", "pending", "running", "completed", "failed"] as const;

type StatusFilter = (typeof statusFilters)[number];

type SortColumn = "filename" | "findings" | "severity" | "date";

const severityRank: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function SortableHead({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  active: boolean;
  direction: "asc" | "desc";
  onSort: (column: SortColumn) => void;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead>
      <button
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 hover:text-on-surface ${active ? "text-on-surface" : ""}`}
      >
        {label}
        <Icon size={12} />
      </button>
    </TableHead>
  );
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export default function HistoryPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getJobs(page, limit, status);
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteJob(deleteId);
      setDeleteId(null);
      fetchJobs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      setError(message);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const from = data && data.total > 0 ? (data.page - 1) * data.limit + 1 : 0;
  const to = data && data.total > 0 ? Math.min(data.page * data.limit, data.total) : 0;

  // Ordena solo la pagina actual ya cargada (sin pedir de nuevo al backend) -
  // suficiente para que el usuario pueda priorizar por severidad/hallazgos
  // sin tener que mirar fila por fila.
  const sortedItems = React.useMemo(() => {
    if (!data || !sortColumn) return data?.items ?? [];
    const items = [...data.items];
    const dir = sortDirection === "asc" ? 1 : -1;
    items.sort((a, b) => {
      switch (sortColumn) {
        case "filename":
          return dir * a.filename.localeCompare(b.filename);
        case "findings":
          return dir * ((a.findings_count ?? -1) - (b.findings_count ?? -1));
        case "severity":
          // Invertido a proposito: "desc" (default) significa "mas grave primero"
          // (rank mas bajo = critical), no "numero de rank mas alto primero".
          return (
            -dir *
            ((severityRank[a.highest_severity ?? ""] ?? 99) -
              (severityRank[b.highest_severity ?? ""] ?? 99))
          );
        case "date":
          return (
            dir *
            (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
          );
        default:
          return 0;
      }
    });
    return items;
  }, [data, sortColumn, sortDirection]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-on-surface">{t("history.title")}</h1>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter}
            variant={status === filter ? "primary" : "ghost"}
            size="sm"
            onClick={() => {
              setStatus(filter);
              setPage(1);
            }}
          >
            {t(`history.filters.${filter}`)}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center text-on-surface-variant">
          {t("common.loading")}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="rounded bg-surface outline outline-1 outline-outline-variant">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label={t("history.columns.filename")}
                  column="filename"
                  active={sortColumn === "filename"}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <TableHead>{t("history.columns.package")}</TableHead>
                <TableHead>{t("history.columns.status")}</TableHead>
                <SortableHead
                  label={t("history.columns.findings")}
                  column="findings"
                  active={sortColumn === "findings"}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHead
                  label={t("history.columns.severity")}
                  column="severity"
                  active={sortColumn === "severity"}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHead
                  label={t("history.columns.date")}
                  column="date"
                  active={sortColumn === "date"}
                  direction={sortDirection}
                  onSort={toggleSort}
                />
                <TableHead className="text-right">{t("history.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((job, index) => (
                <TableRow
                  key={job.id}
                  className={index % 2 === 1 ? "bg-surface-container-low/50" : ""}
                >
                  <TableCell className="font-medium">{job.filename}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.package_name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={job.status} />
                      <span className="capitalize">{t(`history.status.${job.status}`)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{job.findings_count ?? "-"}</TableCell>
                  <TableCell>
                    {job.highest_severity ? (
                      <Badge
                        variant={
                          job.highest_severity.toLowerCase() as
                            | "critical"
                            | "high"
                            | "medium"
                            | "low"
                            | "info"
                        }
                      >
                        {t(`severity.${job.highest_severity.toLowerCase()}`)}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(job.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${locale}/jobs/${job.id}`}>{t("common.view")}</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(job.id)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={16} className="text-error" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/50 px-4 py-3 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span>{t("history.pagination.showing", { from, to, total: data.total })}</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded bg-surface-container-high px-2 py-1 text-sm text-on-surface outline outline-1 outline-outline-variant"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("history.pagination.previous")}
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={page === p ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t("history.pagination.next")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded bg-surface py-16 text-center outline outline-1 outline-outline-variant">
          <ClipboardList size={48} className="text-on-surface-variant" />
          <p className="text-lg font-medium text-on-surface">{t("history.emptyState.title")}</p>
          <Button variant="primary" asChild>
            <Link href={`/${locale}`}>{t("history.emptyState.uploadFirst")}</Link>
          </Button>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded bg-surface p-6 shadow-lg outline outline-1 outline-outline-variant">
            <h2 className="text-lg font-semibold text-on-surface">
              {t("history.deleteModal.title")}
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t("history.deleteModal.description")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
