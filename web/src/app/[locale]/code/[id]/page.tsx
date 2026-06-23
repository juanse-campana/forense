"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getJob, getJobFileContent, type JobDetails } from "@/lib/api";

type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "annotation"
  | "text";

interface Token {
  type: TokenType;
  value: string;
}

const JAVA_KEYWORDS = [
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
  "class", "const", "continue", "default", "do", "double", "else", "enum",
  "extends", "final", "finally", "float", "for", "goto", "if", "implements",
  "import", "instanceof", "int", "interface", "long", "native", "new",
  "package", "private", "protected", "public", "return", "short", "static",
  "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
  "transient", "try", "void", "volatile", "while", "true", "false", "null",
];

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: "text-primary",
  string: "text-secondary",
  comment: "text-on-surface-variant italic",
  number: "text-tertiary",
  annotation: "text-tertiary",
  text: "text-on-surface",
};

function tokenizeJava(code: string): Token[] {
  const tokens: Token[] = [];
  const keywordAlt = JAVA_KEYWORDS.join("|");
  // Order matters: comments and strings before keywords/numbers so that
  // keywords inside strings/comments are not mis-highlighted.
  const pattern = new RegExp(
    [
      "(\\/\\/[^\\n]*)", // 1: line comment
      "(\\/\\*[\\s\\S]*?\\*\\/)", // 2: block comment
      "(\"\"\"[\\s\\S]*?\"\"\")", // 3: text block
      "(\"(?:[^\"\\\\]|\\\\.)*\")", // 4: double-quoted string
      "('@[A-Za-z_][\\w]*')", // 5: annotation (quoted to avoid empty alt issue)
      "(\\b\\d[\\d_]*\\.?\\d*(?:[eE][+-]?\\d+)?[fFdDlL]?\\b)", // 6: number
      `(\\b(?:${keywordAlt})\\b)`, // 7: keyword
    ].join("|"),
    "g"
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: code.slice(lastIndex, match.index) });
    }
    let type: TokenType = "text";
    if (match[1] || match[2]) type = "comment";
    else if (match[3] || match[4]) type = "string";
    else if (match[5]) type = "annotation";
    else if (match[6]) type = "number";
    else if (match[7]) type = "keyword";
    tokens.push({ type, value: match[0] });
    lastIndex = pattern.lastIndex;
    // Guard against zero-length matches
    if (pattern.lastIndex === match.index) pattern.lastIndex++;
  }
  if (lastIndex < code.length) {
    tokens.push({ type: "text", value: code.slice(lastIndex) });
  }
  return tokens;
}

function tokensToLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.value.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ type: token.type, value: part });
    });
  }
  return lines;
}

function CodeViewerContent() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const id = params.id as string;
  const searchParams = useSearchParams();
  const filePath = searchParams.get("path") || "";

  const [job, setJob] = useState<JobDetails | null>(null);
  const [content, setContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      if (!id || !filePath) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [jobData, fileData] = await Promise.all([
          getJob(id),
          getJobFileContent(id, filePath),
        ]);
        if (cancelled) return;
        setJob(jobData);
        setContent(fileData.content);
        setFileName(fileData.name || fileData.path || filePath);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.error");
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [id, filePath, t]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; silently ignore
    }
  };

  const lines = React.useMemo(() => tokensToLines(tokenizeJava(content)), [content]);
  const jobName = job?.apk_name || job?.filename || id;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-on-surface-variant">
        {t("common.loading")}
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="px-0">
          <Link href={`/${locale}/explorer/${id}`}>
            <ArrowLeft size={16} />
            {t("codeViewer.back")}
          </Link>
        </Button>
        <div className="rounded bg-error/10 p-4 text-sm text-error">
          {t("common.error")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="px-0">
          <Link href={`/${locale}/explorer/${id}`}>
            <ArrowLeft size={16} />
            {t("codeViewer.back")}
          </Link>
        </Button>
        <div className="rounded bg-error/10 p-4 text-sm text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="px-0">
            <Link href={`/${locale}/explorer/${id}`}>
              <ArrowLeft size={16} />
              {t("codeViewer.back")}
            </Link>
          </Button>
          <nav className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              href={`/${locale}/jobs/${id}`}
              className="truncate font-medium text-primary hover:underline"
            >
              {jobName}
            </Link>
            <span className="text-on-surface-variant">/</span>
            <span className="truncate font-mono text-xs text-on-surface-variant">
              {fileName || filePath}
            </span>
          </nav>
        </div>
        <Button variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? t("common.confirm") : t("codeViewer.copy")}
        </Button>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded bg-surface-container-lowest outline outline-1 outline-outline-variant">
        <div className="flex">
          {/* Line number gutter */}
          <div
            aria-hidden="true"
            className="sticky left-0 z-10 select-none border-r border-outline-variant/50 bg-surface-container-lowest px-3 py-3 text-right font-mono text-xs leading-[1.6] text-on-surface-variant/60"
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Code */}
          <pre className="flex-1 overflow-x-auto py-3 pl-4 pr-6 font-mono text-xs leading-[1.6]">
            <code className="text-on-surface">
              {lines.map((lineTokens, i) => (
                <div key={i} className="whitespace-pre">
                  {lineTokens.length === 0 ? (
                    "\u00A0"
                  ) : (
                    lineTokens.map((token, j) => (
                      <span key={j} className={TOKEN_COLORS[token.type]}>
                        {token.value}
                      </span>
                    ))
                  )}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function CodeViewerPage() {
  const t = useTranslations();
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-on-surface-variant">
          {t("common.loading")}
        </div>
      }
    >
      <CodeViewerContent />
    </Suspense>
  );
}
