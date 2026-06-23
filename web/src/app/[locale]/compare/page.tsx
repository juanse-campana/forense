"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJobs, getJob, type Job, type JobDetails, type Finding } from "@/lib/api";

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function findingKey(f: Finding): string {
  return `${f.title}|${f.file || ""}`;
}

function JobSummaryCard({
  job,
  label,
}: {
  job: JobDetails;
  label: string;
}) {
  const t = useTranslations();
  const status = job.status as "pending" | "running" | "completed" | "failed";
  const findingsCount = job.findings_count ?? job.findings?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("history.columns.filename")}</span>
          <span className="truncate font-mono text-xs">{job.apk_name || job.filename}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("history.columns.package")}</span>
          <span className="font-mono text-xs">{job.package_name || "-"}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("results.version")}</span>
          <span>{job.version_name || "-"}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("history.columns.status")}</span>
          <span className="flex items-center gap-1.5">
            <StatusIndicator status={status} />
            {t(`history.status.${status}`)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("history.columns.findings")}</span>
          <span className="font-medium text-on-surface">{findingsCount}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-on-surface-variant">{t("results.obfuscation")}</span>
          <span className="font-mono">
            {job.obfuscation_score ?? "-"}
            {job.obfuscation_score !== undefined ? " / 100" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingsSection({
  title,
  findings,
}: {
  title: string;
  findings: Finding[];
}) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant="info">{findings.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {findings.length > 0 ? (
          <ul className="space-y-1">
            {findings.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded bg-surface-container-high px-3 py-2"
              >
                <Badge variant={f.severity.toLowerCase()} className="mt-0.5 shrink-0">
                  {t(`severity.${f.severity.toLowerCase()}`)}
                </Badge>
                <div className="min-w-0">
                  <div className="text-sm text-on-surface">{f.title}</div>
                  {f.file && (
                    <div className="truncate font-mono text-xs text-on-surface-variant">
                      {f.file}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">{t("results.noFindings")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataDiffTable({
  jobA,
  jobB,
}: {
  jobA: JobDetails;
  jobB: JobDetails;
}) {
  const t = useTranslations();
  const nameA = jobA.apk_name || jobA.filename;
  const nameB = jobB.apk_name || jobB.filename;

  const rows: { label: string; a: string; b: string }[] = [
    { label: t("history.columns.filename"), a: jobA.filename, b: jobB.filename },
    {
      label: t("history.columns.package"),
      a: jobA.package_name || "-",
      b: jobB.package_name || "-",
    },
    {
      label: t("results.version"),
      a: jobA.version_name || "-",
      b: jobB.version_name || "-",
    },
    {
      label: t("results.size"),
      a: formatBytes(jobA.file_size),
      b: formatBytes(jobB.file_size),
    },
    {
      label: t("results.obfuscation"),
      a: jobA.obfuscation_score !== undefined ? String(jobA.obfuscation_score) : "-",
      b: jobB.obfuscation_score !== undefined ? String(jobB.obfuscation_score) : "-",
    },
    {
      label: t("history.columns.findings"),
      a: String(jobA.findings_count ?? jobA.findings?.length ?? 0),
      b: String(jobB.findings_count ?? jobB.findings?.length ?? 0),
    },
    {
      label: t("results.minSdk"),
      a: jobA.min_sdk !== undefined ? String(jobA.min_sdk) : "-",
      b: jobB.min_sdk !== undefined ? String(jobB.min_sdk) : "-",
    },
    {
      label: t("results.targetSdk"),
      a: jobA.target_sdk !== undefined ? String(jobA.target_sdk) : "-",
      b: jobB.target_sdk !== undefined ? String(jobB.target_sdk) : "-",
    },
    {
      label: t("results.activities"),
      a: String(jobA.activities_count ?? 0),
      b: String(jobB.activities_count ?? 0),
    },
    {
      label: t("results.services"),
      a: String(jobA.services_count ?? 0),
      b: String(jobB.services_count ?? 0),
    },
    {
      label: t("results.receivers"),
      a: String(jobA.receivers_count ?? 0),
      b: String(jobB.receivers_count ?? 0),
    },
    {
      label: t("results.providers"),
      a: String(jobA.providers_count ?? 0),
      b: String(jobB.providers_count ?? 0),
    },
    {
      label: t("results.nativeLibs"),
      a: String(jobA.native_libs_count ?? 0),
      b: String(jobB.native_libs_count ?? 0),
    },
    {
      label: t("results.dexFiles"),
      a: String(jobA.dex_files_count ?? 0),
      b: String(jobB.dex_files_count ?? 0),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("compare.metadataDiff")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded bg-surface outline outline-1 outline-outline-variant">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("results.metadata")}</TableHead>
                <TableHead className="font-mono text-xs">{nameA}</TableHead>
                <TableHead className="font-mono text-xs">{nameB}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const diff = row.a !== row.b;
                return (
                  <TableRow
                    key={i}
                    className={i % 2 === 1 ? "bg-surface-container-low/50" : ""}
                  >
                    <TableCell className="text-on-surface-variant">{row.label}</TableCell>
                    <TableCell
                      className={`font-mono text-xs ${
                        diff ? "text-primary" : "text-on-surface"
                      }`}
                    >
                      {row.a}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-xs ${
                        diff ? "text-secondary" : "text-on-surface"
                      }`}
                    >
                      {row.b}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const t = useTranslations();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [jobA, setJobA] = useState<JobDetails | null>(null);
  const [jobB, setJobB] = useState<JobDetails | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchJobs = async () => {
      try {
        const data = await getJobs(1, 100);
        if (!cancelled) setJobs(data.items);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.error");
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    fetchJobs();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const canCompare =
    selectedA && selectedB && selectedA !== selectedB && !loadingCompare;

  const handleCompare = async () => {
    if (!canCompare) return;
    setLoadingCompare(true);
    setError(null);
    setJobA(null);
    setJobB(null);
    try {
      const [a, b] = await Promise.all([getJob(selectedA), getJob(selectedB)]);
      setJobA(a);
      setJobB(b);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      setError(message);
    } finally {
      setLoadingCompare(false);
    }
  };

  const { shared, uniqueA, uniqueB } = useMemo(() => {
    if (!jobA || !jobB) return { shared: [], uniqueA: [], uniqueB: [] };
    const findingsA = jobA.findings || [];
    const findingsB = jobB.findings || [];
    const keysB = new Set(findingsB.map(findingKey));
    const keysA = new Set(findingsA.map(findingKey));
    return {
      shared: findingsA.filter((f) => keysB.has(findingKey(f))),
      uniqueA: findingsA.filter((f) => !keysB.has(findingKey(f))),
      uniqueB: findingsB.filter((f) => !keysA.has(findingKey(f))),
    };
  }, [jobA, jobB]);

  const selectClass =
    "w-full rounded bg-surface-container-high px-3 py-2 text-sm text-on-surface outline outline-1 outline-outline-variant focus:outline-primary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitCompare size={24} className="text-primary" />
        <h1 className="text-2xl font-semibold text-on-surface">
          {t("compare.title")}
        </h1>
      </div>

      {error && (
        <div className="rounded bg-error/10 p-4 text-sm text-error">{error}</div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <label
                htmlFor="compare-a"
                className="text-sm font-medium text-on-surface-variant"
              >
                {t("compare.selectA")}
              </label>
              <select
                id="compare-a"
                value={selectedA}
                onChange={(e) => setSelectedA(e.target.value)}
                disabled={loadingJobs}
                className={selectClass}
              >
                <option value="">
                  {loadingJobs ? t("common.loading") : t("compare.selectA")}
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="compare-b"
                className="text-sm font-medium text-on-surface-variant"
              >
                {t("compare.selectB")}
              </label>
              <select
                id="compare-b"
                value={selectedB}
                onChange={(e) => setSelectedB(e.target.value)}
                disabled={loadingJobs}
                className={selectClass}
              >
                <option value="">
                  {loadingJobs ? t("common.loading") : t("compare.selectB")}
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.filename}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleCompare}
              disabled={!canCompare}
              className="lg:h-[38px]"
            >
              <GitCompare size={16} />
              {t("compare.compare")}
            </Button>
          </div>

          {selectedA && selectedB && selectedA === selectedB && (
            <p className="mt-3 text-xs text-warning">
              {t("compare.selectA")} ≠ {t("compare.selectB")}
            </p>
          )}
        </CardContent>
      </Card>

      {loadingCompare && (
        <div className="flex h-32 items-center justify-center text-on-surface-variant">
          {t("common.loading")}
        </div>
      )}

      {!loadingCompare && jobA && jobB && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <JobSummaryCard
              job={jobA}
              label={`${t("compare.selectA")} — ${jobA.apk_name || jobA.filename}`}
            />
            <JobSummaryCard
              job={jobB}
              label={`${t("compare.selectB")} — ${jobB.apk_name || jobB.filename}`}
            />
          </div>

          <MetadataDiffTable jobA={jobA} jobB={jobB} />

          <FindingsSection
            title={t("compare.sharedFindings")}
            findings={shared}
          />
          <FindingsSection
            title={t("compare.uniqueToA")}
            findings={uniqueA}
          />
          <FindingsSection
            title={t("compare.uniqueToB")}
            findings={uniqueB}
          />
        </div>
      )}

      {!loadingCompare && !jobA && !jobB && !error && (
        <div className="flex flex-col items-center justify-center gap-4 rounded bg-surface py-16 text-center outline outline-1 outline-outline-variant">
          <GitCompare size={48} className="text-on-surface-variant" />
          <p className="text-lg font-medium text-on-surface">
            {t("compare.title")}
          </p>
        </div>
      )}
    </div>
  );
}
