"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Shield,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { getJobs, type PaginatedJobs } from "@/lib/api";

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

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-container-high ${color}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className="text-sm text-on-surface-variant">{label}</div>
          <div className="text-3xl font-semibold text-on-surface">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJobs(1, 100)
      .then(setData)
      .catch((err) => setError(err.message || t("common.error")))
      .finally(() => setLoading(false));
  }, [t]);

  const stats = useMemo(() => {
    if (!data) return null;
    const items = data.items;
    const total = items.length;
    const criticalFindings = items.filter(
      (job) => job.highest_severity === "critical"
    ).length;
    const scores = items
      .map((job) => job.obfuscation_score)
      .filter((score): score is number => typeof score === "number");
    const avgObfuscation =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = items.filter(
      (job) => job.created_at && new Date(job.created_at) >= oneWeekAgo
    ).length;
    return { total, criticalFindings, avgObfuscation, thisWeek };
  }, [data]);

  const recentJobs = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((job) => job.status === "completed")
      .slice(0, 5);
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-on-surface-variant">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded bg-error/10 p-4 text-sm text-error">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-on-surface">
        {t("dashboard.title")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={FileText}
          label={t("dashboard.totalAnalyses")}
          value={stats?.total ?? 0}
          color="text-primary"
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t("dashboard.criticalFindings")}
          value={stats?.criticalFindings ?? 0}
          color="text-error"
        />
        <SummaryCard
          icon={Shield}
          label={t("dashboard.avgObfuscation")}
          value={`${stats?.avgObfuscation ?? 0}%`}
          color="text-secondary"
        />
        <SummaryCard
          icon={Calendar}
          label={t("dashboard.thisWeek")}
          value={stats?.thisWeek ?? 0}
          color="text-tertiary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded bg-surface-container-high p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-on-surface">
                        {job.filename}
                      </span>
                      <Badge variant={(job.highest_severity || "info").toLowerCase()}>
                        {job.highest_severity
                          ? t(`severity.${job.highest_severity.toLowerCase()}`)
                          : "-"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
                      <StatusIndicator status={job.status} />
                      <span>{t(`history.status.${job.status}`)}</span>
                      <span>·</span>
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${locale}/jobs/${job.id}`}>
                      {t("common.view")}
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              {t("dashboard.noRecentActivity")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
