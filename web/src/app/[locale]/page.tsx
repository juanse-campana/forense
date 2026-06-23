"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  File,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  uploadApkWithProgress,
  getJob,
  subscribeToProgress,
  type Job,
  type ProgressEvent,
} from "@/lib/api";

type UploadState =
  | { status: "idle" }
  | { status: "file-selected"; file: File }
  | { status: "uploading"; file: File; progress: number }
  | { status: "analyzing"; job: Job; progress: number; message: string }
  | { status: "completed"; job: Job }
  | { status: "error"; message: string };

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function UploadPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const currentJobRef = useRef<Job | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelect(file);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    []
  );

  const validateAndSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".apk")) {
      setState({ status: "error", message: t("upload.invalidType") });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setState({ status: "error", message: t("upload.fileTooLarge") });
      return;
    }
    setState({ status: "file-selected", file });
  };

  const handleUpload = async () => {
    if (state.status !== "file-selected") return;
    const { file } = state;
    setState({ status: "uploading", file, progress: 0 });

    try {
      const job = await uploadApkWithProgress(file, (progress) => {
        setState({ status: "uploading", file, progress });
      });
      currentJobRef.current = job;
      setState({
        status: "analyzing",
        job,
        progress: 0,
        message: t("upload.analyzing"),
      });
    } catch (err: any) {
      setState({
        status: "error",
        message: err.message || t("upload.serverError"),
      });
    }
  };

  const analyzingJobId =
    state.status === "analyzing" ? state.job.id : null;

  useEffect(() => {
    if (!analyzingJobId) return;

    const es = subscribeToProgress(analyzingJobId, (event: ProgressEvent) => {
      if (event.progress !== undefined) {
        setState((prev) =>
          prev.status === "analyzing" && prev.job.id === analyzingJobId
            ? {
                ...prev,
                progress: event.progress,
                message:
                  event.message || event.module || prev.message,
              }
            : prev
        );
      }
      if (event.type === "completed") {
        setState({
          status: "completed",
          job: currentJobRef.current || { id: analyzingJobId, status: "completed", filename: "" },
        });
      } else if (event.type === "error") {
        setState({
          status: "error",
          message: event.message || t("upload.analysisError"),
        });
      }
    });

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getJob(analyzingJobId);
        if (updatedJob.status === "completed") {
          setState({ status: "completed", job: updatedJob });
        } else if (updatedJob.status === "failed") {
          setState({ status: "error", message: t("upload.analysisError") });
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [analyzingJobId, t]);

  const reset = () => {
    setState({ status: "idle" });
    setIsDragging(false);
    currentJobRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openFileDialog = () => fileInputRef.current?.click();

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={20} className="text-primary" />
            {t("upload.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Zone */}
          {(state.status === "idle" ||
            state.status === "file-selected" ||
            state.status === "error") && (
            <div
              onClick={openFileDialog}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded p-12 text-center cursor-pointer bg-surface-container-lowest transition-colors",
                isDragging
                  ? "border-primary"
                  : "border-outline-variant hover:border-primary/50"
              )}
              style={
                isDragging
                  ? { boxShadow: "0 0 0 2px #8ed5ff" }
                  : undefined
              }
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload
                size={48}
                className={cn(
                  "mx-auto mb-4",
                  isDragging ? "text-primary" : "text-on-surface-variant"
                )}
              />
              <p className="text-sm text-on-surface mb-1">
                {t("upload.dragDrop")}
              </p>
              <p className="text-xs text-on-surface-variant">
                {t("upload.orClick")}
              </p>
              <p className="text-xs text-on-surface-variant mt-2">
                {t("upload.maxSize")}
              </p>
            </div>
          )}

          {/* File Selected */}
          {state.status === "file-selected" && (
            <div className="flex items-center gap-4 p-4 rounded bg-surface-container-low">
              <File size={32} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">
                  {state.file.name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {formatBytes(state.file.size)}
                </p>
              </div>
              <button
                onClick={reset}
                className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant"
                aria-label={t("common.cancel")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Error */}
          {state.status === "error" && (
            <div className="flex items-center gap-3 p-4 rounded bg-surface-container-low">
              <XCircle size={24} className="text-error shrink-0" />
              <p className="text-sm text-error">{state.message}</p>
            </div>
          )}

          {/* Uploading */}
          {state.status === "uploading" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface">
                  {t("upload.uploading")}
                </span>
                <span className="text-on-surface-variant">
                  {state.progress}%
                </span>
              </div>
              <Progress value={state.progress} variant="pulse" />
            </div>
          )}

          {/* Analyzing */}
          {state.status === "analyzing" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface">{state.message}</span>
                <span className="text-on-surface-variant">
                  {state.progress}%
                </span>
              </div>
              <Progress value={state.progress} variant="pulse" />
            </div>
          )}

          {/* Completed */}
          {state.status === "completed" && (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 size={48} className="text-secondary" />
                <p className="text-lg font-semibold text-on-surface">
                  {t("upload.completed")}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="primary" asChild>
                  <Link href={`/${locale}/jobs/${state.job.id}`}>
                    {t("upload.viewResults")}
                  </Link>
                </Button>
                <Button variant="ghost" onClick={reset}>
                  {t("upload.analyzeAnother")}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {(state.status === "idle" ||
            state.status === "file-selected" ||
            state.status === "error") && (
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={reset}

              >
                {t("common.cancel")}
              </Button>
              {state.status === "error" ? (
                <Button variant="primary" onClick={reset}>
                  {t("upload.tryAgain")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  disabled={state.status !== "file-selected"}
                >
                  {t("upload.analyze")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
