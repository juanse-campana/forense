"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJob, type JobDetails, type Finding } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const tabs = [
  "overview",
  "findings",
  "permissions",
  "crypto",
  "structure",
  "manifest",
  "obfuscation",
] as const;

type Tab = (typeof tabs)[number];

const severityFilters = ["all", "critical", "high", "medium", "low", "info"] as const;

const severityOrder: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

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

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function isWeakAlgorithm(algorithm: string): boolean {
  const normalized = algorithm.toLowerCase();
  return (
    normalized.includes("md5") ||
    normalized.includes("sha1") ||
    normalized.includes("ecb")
  );
}

function obfuscationInterpretation(score: number): {
  label: string;
  color: string;
} {
  if (score <= 30) return { label: "low", color: "text-error" };
  if (score <= 60) return { label: "moderate", color: "text-warning" };
  return { label: "high", color: "text-secondary" };
}

function ExportButton({
  id,
  format,
  label,
}: {
  id: string;
  format: string;
  label: string;
}) {
  return (
    <Button variant="secondary" size="sm" asChild>
      <a href={`${API_BASE}/api/v1/jobs/${id}/report.${format}`} download>
        <Download size={16} />
        {label}
      </a>
    </Button>
  );
}

function OverviewTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.metadata")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("history.columns.filename")}</span>
            <span className="font-mono">{job.filename}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("results.size")}</span>
            <span>{formatBytes(job.file_size)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("history.columns.package")}</span>
            <span className="font-mono">{job.package_name || "-"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("results.version")}</span>
            <span>{job.version_name || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.hashes")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="break-all font-mono text-xs">
            <span className="text-on-surface-variant">MD5:</span> {job.md5 || "-"}
          </div>
          <div className="break-all font-mono text-xs">
            <span className="text-on-surface-variant">SHA256:</span> {job.sha256 || "-"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.sdk")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("results.minSdk")}</span>
            <span className="font-mono">{job.min_sdk ?? "-"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{t("results.targetSdk")}</span>
            <span className="font-mono">{job.target_sdk ?? "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.components")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded bg-surface-container-high p-2 text-center">
            <div className="text-lg font-semibold text-on-surface">{job.activities_count ?? 0}</div>
            <div className="text-xs text-on-surface-variant">{t("results.activities")}</div>
          </div>
          <div className="rounded bg-surface-container-high p-2 text-center">
            <div className="text-lg font-semibold text-on-surface">{job.services_count ?? 0}</div>
            <div className="text-xs text-on-surface-variant">{t("results.services")}</div>
          </div>
          <div className="rounded bg-surface-container-high p-2 text-center">
            <div className="text-lg font-semibold text-on-surface">{job.receivers_count ?? 0}</div>
            <div className="text-xs text-on-surface-variant">{t("results.receivers")}</div>
          </div>
          <div className="rounded bg-surface-container-high p-2 text-center">
            <div className="text-lg font-semibold text-on-surface">{job.providers_count ?? 0}</div>
            <div className="text-xs text-on-surface-variant">{t("results.providers")}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.nativeLibs")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-on-surface">{job.native_libs_count ?? 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.dexFiles")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-on-surface">{job.dex_files_count ?? 0}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function FindingsTab({
  findings,
  severityFilter,
  setSeverityFilter,
}: {
  findings: Finding[];
  severityFilter: (typeof severityFilters)[number];
  setSeverityFilter: (value: (typeof severityFilters)[number]) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {severityFilters.map((filter) => (
            <Button
              key={filter}
              variant={severityFilter === filter ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSeverityFilter(filter)}
            >
              {t(`results.filters.${filter}`)}
            </Button>
          ))}
        </div>
        <span className="text-sm text-on-surface-variant">
          {findings.length} {t("history.columns.findings")}
        </span>
      </div>

      {findings.length > 0 ? (
        <div className="rounded bg-surface outline outline-1 outline-outline-variant">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("results.columns.severity")}</TableHead>
                <TableHead>{t("results.columns.category")}</TableHead>
                <TableHead>{t("results.columns.title")}</TableHead>
                <TableHead>{t("results.columns.file")}</TableHead>
                <TableHead>{t("results.columns.line")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding, index) => (
                <TableRow
                  key={index}
                  className={index % 2 === 1 ? "bg-surface-container-low/50" : ""}
                >
                  <TableCell>
                    <Badge variant={finding.severity}>{t(`severity.${finding.severity}`)}</Badge>
                  </TableCell>
                  <TableCell>{finding.category}</TableCell>
                  <TableCell>{finding.title}</TableCell>
                  <TableCell className="font-mono text-xs">{finding.file || "-"}</TableCell>
                  <TableCell>{finding.line ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded bg-surface py-12 text-center text-on-surface-variant outline outline-1 outline-outline-variant">
          {t("results.noFindings")}
        </div>
      )}
    </div>
  );
}

function PermissionsTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  const dangerous = job.dangerous_permissions || [];
  const all = job.permissions || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle size={16} className="text-error" />
            {t("results.dangerousPermissions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dangerous.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dangerous.map((permission) => (
                <Badge key={permission} variant="critical" className="font-mono">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">{t("results.noPermissions")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.allPermissions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {all.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {all.map((permission, index) => {
                const isDangerous =
                  permission.dangerous || dangerous.includes(permission.name);
                return (
                  <span
                    key={index}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-mono ${
                      isDangerous
                        ? "bg-error/15 text-error"
                        : "bg-secondary/15 text-secondary"
                    }`}
                  >
                    {permission.name}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">{t("results.noPermissions")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CryptoTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  const items = job.crypto || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("results.crypto")}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("results.columns.algorithm")}</TableHead>
                <TableHead>{t("results.columns.type")}</TableHead>
                <TableHead>{t("results.columns.risk")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry, index) => {
                const weak = isWeakAlgorithm(entry.algorithm);
                return (
                  <TableRow
                    key={index}
                    className={index % 2 === 1 ? "bg-surface-container-low/50" : ""}
                  >
                    <TableCell className="font-mono">{entry.algorithm}</TableCell>
                    <TableCell>{entry.type}</TableCell>
                    <TableCell>
                      {weak ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-warning">
                          <AlertTriangle size={14} />
                          {t("results.weakAlgorithms")}
                        </span>
                      ) : (
                        <span className="text-sm text-secondary">{entry.risk || "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-on-surface-variant">{t("results.noCrypto")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function FileList({
  title,
  files,
}: {
  title: string;
  files: { path: string; size?: number }[];
}) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {files.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded bg-surface-container-high px-3 py-2"
              >
                <span className="font-mono text-xs">{file.path}</span>
                <span className="text-xs text-on-surface-variant">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">{t("results.noStructure")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StructureTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <FileList title={t("results.tabs.structure")} files={job.interesting_files || []} />
      <FileList title={t("results.nativeLibs")} files={job.native_libs || []} />
      <FileList title={t("results.dexFiles")} files={job.dex_files || []} />
    </div>
  );
}

function ManifestTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  const content =
    job.manifest ||
    [
      `package: ${job.package_name || "-"}`,
      `version: ${job.version_name || "-"}`,
      `debuggable: ${job.debuggable ?? false}`,
      `allowBackup: ${job.allow_backup ?? false}`,
    ].join("\n");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("results.tabs.manifest")}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[600px] overflow-auto rounded bg-surface-container-high p-4 font-mono text-xs text-on-surface">
          {content}
        </pre>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div
            className={`flex items-center gap-2 ${
              job.debuggable ? "text-error" : "text-secondary"
            }`}
          >
            <span className="font-medium">{t("results.debuggable")}:</span>
            {job.debuggable ? t("common.confirm") : t("common.cancel")}
          </div>
          <div
            className={`flex items-center gap-2 ${
              job.allow_backup ? "text-warning" : "text-secondary"
            }`}
          >
            <span className="font-medium">{t("results.allowBackup")}:</span>
            {job.allow_backup ? t("common.confirm") : t("common.cancel")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ObfuscationTab({ job }: { job: JobDetails }) {
  const t = useTranslations();
  const score = job.obfuscation_score ?? 0;
  const interpretation = obfuscationInterpretation(score);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("results.obfuscation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className={`text-6xl font-bold ${interpretation.color}`}>{score}</div>
            <div className="w-full max-w-md">
              <Progress value={score} />
            </div>
            <p className="text-lg font-medium text-on-surface">
              {t("results.interpretation")}:{" "}
              <span className={interpretation.color}>{t(`results.${interpretation.label}`)}</span>
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-on-surface-variant">
              {t("results.indicators")}
            </h3>
            {job.obfuscation_indicators && job.obfuscation_indicators.length > 0 ? (
              <ul className="space-y-1">
                {job.obfuscation_indicators.map((indicator, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-on-surface">
                    <Shield size={14} className="text-secondary" />
                    {indicator}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">{t("results.noIndicators")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobResultsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const id = params.id as string;
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [severityFilter, setSeverityFilter] = useState<(typeof severityFilters)[number]>("all");

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getJob(id);
        if (!cancelled) setJob(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.error");
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const filteredFindings = useMemo(() => {
    const list = job?.findings ?? [];
    if (severityFilter === "all") return list;
    return list.filter((f) => f.severity === severityFilter);
  }, [job?.findings, severityFilter]);

  const sortedFindings = useMemo(() => {
    return [...filteredFindings].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [filteredFindings]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-on-surface-variant">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/${locale}/history`}>
            <ArrowLeft size={16} />
            {t("common.back")}
          </Link>
        </Button>
        <div className="rounded bg-error/10 p-4 text-sm text-error">
          {error || t("common.error")}
        </div>
      </div>
    );
  }

  const status = job.status as "pending" | "running" | "completed" | "failed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded bg-surface p-4 outline outline-1 outline-outline-variant sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="mb-2 px-0">
            <Link href={`/${locale}/history`}>
              <ArrowLeft size={16} />
              {t("common.back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-on-surface">
            {job.apk_name || job.filename}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
            {job.package_name && (
              <span className="font-mono">{job.package_name}</span>
            )}
            {job.version_name && <span>v{job.version_name}</span>}
            <Badge
              variant={
                status === "completed"
                  ? "info"
                  : status === "failed"
                  ? "critical"
                  : "info"
              }
            >
              <span className="flex items-center gap-1.5">
                <StatusIndicator status={status} />
                {t(`history.status.${status}`)}
              </span>
            </Badge>
            <span>{formatDate(job.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton id={id} format="json" label={t("results.exportJson")} />
          <ExportButton id={id} format="html" label={t("results.exportHtml")} />
          <ExportButton id={id} format="md" label={t("results.exportMarkdown")} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-outline-variant/50 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-surface text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t(`results.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === "overview" && <OverviewTab job={job} />}
        {activeTab === "findings" && (
          <FindingsTab
            findings={sortedFindings}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
          />
        )}
        {activeTab === "permissions" && <PermissionsTab job={job} />}
        {activeTab === "crypto" && <CryptoTab job={job} />}
        {activeTab === "structure" && <StructureTab job={job} />}
        {activeTab === "manifest" && <ManifestTab job={job} />}
        {activeTab === "obfuscation" && <ObfuscationTab job={job} />}
      </div>
    </div>
  );
}
