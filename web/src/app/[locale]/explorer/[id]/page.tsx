"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileType,
  FileText,
  File,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJobFiles, getJobFileContent, type FileNode } from "@/lib/api";

function getFileIcon(node: FileNode, isOpen: boolean) {
  if (node.type === "directory") {
    return isOpen ? (
      <FolderOpen size={16} className="text-primary shrink-0" />
    ) : (
      <Folder size={16} className="text-primary shrink-0" />
    );
  }

  const ext = node.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "java":
    case "kt":
      return <FileCode size={16} className="text-secondary shrink-0" />;
    case "json":
      return <FileJson size={16} className="text-warning shrink-0" />;
    case "xml":
      return <FileType size={16} className="text-tertiary shrink-0" />;
    case "txt":
    case "md":
      return <FileText size={16} className="text-on-surface-variant shrink-0" />;
    default:
      return <File size={16} className="text-on-surface-variant shrink-0" />;
  }
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  directoryCache: Map<string, FileNode[]>;
  onToggle: (path: string) => void;
  onSelectFile: (node: FileNode) => void;
  isLoading: boolean;
}

function TreeNode({
  node,
  level,
  selectedPath,
  expandedPaths,
  directoryCache,
  onToggle,
  onSelectFile,
  isLoading,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const children = directoryCache.get(node.path);

  const handleClick = () => {
    if (node.type === "directory") {
      onToggle(node.path);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm transition-colors rounded ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-on-surface hover:bg-surface-container-high"
        }`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {node.type === "directory" && (
          <span className="shrink-0 text-on-surface-variant">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        {node.type === "file" && <span className="w-[14px] shrink-0" />}
        {getFileIcon(node, isExpanded)}
        <span className="truncate font-mono text-xs">{node.name}</span>
      </button>
      {node.type === "directory" && isExpanded && (
        <div>
          {isLoading && children === undefined ? (
            <div
              className="px-2 py-1 text-xs text-on-surface-variant"
              style={{ paddingLeft: `${8 + (level + 1) * 16}px` }}
            >
              Loading...
            </div>
          ) : children && children.length > 0 ? (
            children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                directoryCache={directoryCache}
                onToggle={onToggle}
                onSelectFile={onSelectFile}
                isLoading={isLoading}
              />
            ))
          ) : (
            <div
              className="px-2 py-1 text-xs text-on-surface-variant"
              style={{ paddingLeft: `${8 + (level + 1) * 16}px` }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExplorerPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params.locale as string) || "es";
  const id = params.id as string;

  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [directoryCache, setDirectoryCache] = useState<Map<string, FileNode[]>>(new Map());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadDirectory = useCallback(
    async (path: string) => {
      try {
        const data = await getJobFiles(id, path || undefined);
        setDirectoryCache((prev) => {
          const next = new Map(prev);
          next.set(path, data);
          return next;
        });
        if (path === "") {
          setRootNodes(data);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load files";
        setError(message);
      }
    },
    [id]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadDirectory("").finally(() => setLoading(false));
  }, [loadDirectory]);

  const handleToggle = useCallback(
    async (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });

      if (!directoryCache.has(path)) {
        await loadDirectory(path);
      }
    },
    [directoryCache, loadDirectory]
  );

  const handleSelectFile = useCallback(
    async (node: FileNode) => {
      setSelectedPath(node.path);
      setFileName(node.name);
      setLoadingContent(true);
      setFileContent(null);
      try {
        const data = await getJobFileContent(id, node.path);
        setFileContent(data.content);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load content";
        setFileContent(`Error: ${message}`);
      } finally {
        setLoadingContent(false);
      }
    },
    [id]
  );

  const filteredRootNodes = searchTerm
    ? rootNodes.filter((n) => n.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : rootNodes;

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/jobs/${id}`}>
            <ArrowLeft size={16} />
            {t("common.back")}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-on-surface">
          {t("explorer.title")}
        </h1>
      </div>

      {error && (
        <div className="rounded bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* File Tree */}
        <Card className="md:col-span-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("explorer.files")}</CardTitle>
            <div className="relative mt-2">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("common.search")}
                className="w-full rounded bg-surface-container-high py-1.5 pl-8 pr-3 text-sm text-on-surface outline outline-1 outline-outline-variant placeholder:text-on-surface-variant focus:outline-primary"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto min-h-0 pt-0">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant">
                {t("common.loading")}
              </div>
            ) : filteredRootNodes.length > 0 ? (
              <div className="py-1">
                {filteredRootNodes.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    selectedPath={selectedPath}
                    expandedPaths={expandedPaths}
                    directoryCache={directoryCache}
                    onToggle={handleToggle}
                    onSelectFile={handleSelectFile}
                    isLoading={loading}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant">
                {searchTerm ? t("explorer.noSearchResults") : t("explorer.noFiles")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Preview */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-mono text-xs truncate">
              {fileName || t("explorer.preview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto min-h-0 pt-0">
            {loadingContent ? (
              <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant">
                {t("common.loading")}
              </div>
            ) : fileContent !== null ? (
              <pre className="font-mono text-xs leading-relaxed text-on-surface whitespace-pre-wrap">
                {fileContent}
              </pre>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant">
                {t("explorer.selectFile")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
