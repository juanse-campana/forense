"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getFindingCodeSnippet } from "@/lib/api";
import type { CodeSnippet, Finding } from "@/lib/api";

interface CodeSnippetModalProps {
  jobId: string;
  finding: Finding;
  onClose: () => void;
}

// Las razones que devuelve el backend son snake_case (mismo formato en toda
// la API); las claves de next-intl son camelCase (convención del resto del
// diccionario) — este mapa es lo único que las conecta.
const REASON_KEY: Record<string, string> = {
  no_location: "noLocation",
  source_not_found: "sourceNotFound",
  tool_missing: "toolMissing",
};

export function CodeSnippetModal({ jobId, finding, onClose }: CodeSnippetModalProps) {
  const t = useTranslations();
  const [snippet, setSnippet] = useState<CodeSnippet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFindingCodeSnippet(jobId, finding.file || "", finding.line || 0, finding.category)
      .then((result) => {
        if (!cancelled) setSnippet(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, finding.file, finding.line, finding.category]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded bg-surface outline outline-1 outline-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant p-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant={finding.severity.toLowerCase() as "critical" | "high" | "medium" | "low" | "info"}>
                {t(`severity.${finding.severity.toLowerCase()}`)}
              </Badge>
              {finding.confidence && finding.confidence !== "HIGH" && (
                <Badge variant="info" title={t("results.confidence.help")}>
                  {t(`results.confidence.${finding.confidence.toLowerCase()}`)}
                </Badge>
              )}
              <span className="truncate font-medium text-on-surface">{finding.title}</span>
            </div>
            <p className="truncate font-mono text-xs text-on-surface-variant">
              {finding.file
                ? `${finding.file}${finding.line ? `:${finding.line}` : ""}`
                : t("results.codeSnippet.noLocation")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-low"
            aria-label={t("results.codeSnippet.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto p-4">
          {loading && (
            <div className="flex h-32 items-center justify-center gap-2 text-on-surface-variant">
              <Loader2 size={18} className="animate-spin" />
              {t("results.codeSnippet.loading")}
            </div>
          )}

          {!loading && error && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
              <FileWarning size={20} />
              {error}
            </div>
          )}

          {!loading && !error && snippet && !snippet.available && (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
              <FileWarning size={20} />
              {t(`results.codeSnippet.${REASON_KEY[snippet.reason || ""] || "sourceNotFound"}`)}
            </div>
          )}

          {!loading && !error && snippet?.available && snippet.is_binary && (
            <div className="space-y-2">
              <p className="text-xs text-on-surface-variant">
                {t("results.codeSnippet.binaryFile")}
              </p>
              <pre className="overflow-x-auto rounded bg-surface-container-low p-3 text-xs leading-relaxed">
                <code>{snippet.snippet}</code>
              </pre>
            </div>
          )}

          {!loading && !error && snippet?.available && !snippet.is_binary && (
            <pre className="overflow-x-auto rounded bg-surface-container-low p-3 text-xs leading-relaxed">
              <code>
                {snippet.snippet?.split("\n").map((codeLine, idx) => {
                  const lineNumber = (snippet.start_line ?? 1) + idx;
                  const isTarget = lineNumber === snippet.line;
                  return (
                    <div
                      key={lineNumber}
                      className={`flex gap-3 px-1 ${isTarget ? "bg-[#EF4444]/15" : ""}`}
                    >
                      <span className="w-10 shrink-0 select-none text-right text-on-surface-variant/60">
                        {lineNumber}
                      </span>
                      <span className="whitespace-pre-wrap break-all">{codeLine}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
