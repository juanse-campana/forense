const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Job {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  filename: string;
  package_name?: string;
  findings_count?: number;
  highest_severity?: "critical" | "high" | "medium" | "low" | "info";
  obfuscation_score?: number;
  created_at?: string;
}

export interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  detail?: string;
  file?: string;
  line?: number;
  evidence?: string;
}

export interface FileEntry {
  path: string;
  size?: number;
}

export interface CryptoEntry {
  algorithm: string;
  type: string;
  risk?: string;
}

export interface PermissionEntry {
  name: string;
  dangerous?: boolean;
}

export interface JobDetails extends Job {
  apk_name?: string;
  package_name?: string;
  version_name?: string;
  created_at?: string;
  completed_at?: string;
  file_size?: number;
  md5?: string;
  sha256?: string;
  min_sdk?: number;
  target_sdk?: number;
  activities_count?: number;
  services_count?: number;
  receivers_count?: number;
  providers_count?: number;
  native_libs_count?: number;
  dex_files_count?: number;
  findings?: Finding[];
  dangerous_permissions?: string[];
  permissions?: PermissionEntry[];
  crypto?: CryptoEntry[];
  interesting_files?: FileEntry[];
  native_libs?: FileEntry[];
  dex_files?: FileEntry[];
  manifest?: string;
  obfuscation_score?: number;
  obfuscation_indicators?: string[];
  debuggable?: boolean;
  allow_backup?: boolean;
  severity_counts?: Record<"critical" | "high" | "medium" | "low" | "info", number>;
}

export interface ProgressEvent {
  type: string;
  progress: number;
  message?: string;
  module?: string;
}

export async function uploadApk(file: File): Promise<Job> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/jobs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `Upload failed: ${response.statusText}`);
  }

  return response.json();
}

export function uploadApkWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<Job> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let detail = "Upload failed";
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body.detail || detail;
        } catch {
          detail = xhr.statusText || detail;
        }
        reject(new Error(detail));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", `${API_BASE}/api/v1/jobs`);
    xhr.send(formData);
  });
}

export async function getJob(id: string): Promise<JobDetails> {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch job" }));
    throw new Error(error.detail || `Failed to fetch job: ${response.statusText}`);
  }

  return response.json();
}

export async function getJobFindings(
  jobId: string,
  page = 1,
  limit = 30,
  severity?: string
): Promise<PaginatedFindings> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (severity && severity !== "all") {
    params.append("severity", severity);
  }

  const response = await fetch(
    `${API_BASE}/api/v1/jobs/${jobId}/findings?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to fetch findings" }));
    throw new Error(
      error.detail || `Failed to fetch findings: ${response.statusText}`
    );
  }

  return response.json();
}

export function subscribeToProgress(
  id: string,
  onProgress: (event: ProgressEvent) => void
): EventSource {
  const es = new EventSource(`${API_BASE}/api/v1/jobs/${id}/progress`);

  // El backend manda eventos SSE con "event:" explicito (progress/completed/
  // failed/heartbeat/close), no el tipo "message" por default. onmessage
  // solo escucha eventos SIN nombre, asi que nunca se disparaba: la barra de
  // progreso quedaba pegada en 0% siempre, haya o no un cuelgue real atras.
  es.addEventListener("progress", (event: MessageEvent) => {
    try {
      onProgress(JSON.parse(event.data));
    } catch {
      // ignore parse errors
    }
  });

  es.addEventListener("completed", () => {
    onProgress({ type: "completed", progress: 100 });
  });

  es.addEventListener("failed", (event: MessageEvent) => {
    onProgress({ type: "error", progress: 0, message: event.data });
  });

  return es;
}

export interface JobListItem extends Job {
  status: "pending" | "running" | "completed" | "failed";
}

export interface PaginatedJobs {
  items: Job[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedFindings {
  items: Finding[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export async function getJobs(
  page = 1,
  limit = 10,
  status?: string
): Promise<PaginatedJobs> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status && status !== "all") params.append("status", status);

  const response = await fetch(`${API_BASE}/api/v1/jobs?${params.toString()}`);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to fetch jobs" }));
    throw new Error(error.detail || `Failed to fetch jobs: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteJob(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete job" }));
    throw new Error(error.detail || `Failed to delete job: ${response.statusText}`);
  }
}

// A diferencia de un <a href> directo al backend, esto valida la respuesta y
// deja al llamador mostrar un error real si el reporte no se pudo generar,
// en vez de fallar en silencio.
export async function exportJob(
  id: string,
  format: "json" | "html" | "md",
  filename: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/jobs/${id}/export?format=${format}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to export report" }));
    throw new Error(error.detail || `Failed to export report: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface FileNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  path: string;
}

export async function getJobFiles(jobId: string, path?: string): Promise<FileNode[]> {
  const params = new URLSearchParams();
  if (path) params.append("path", path);

  const response = await fetch(
    `${API_BASE}/api/v1/jobs/${jobId}/files?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to fetch files" }));
    throw new Error(
      error.detail || `Failed to fetch files: ${response.statusText}`
    );
  }

  return response.json();
}

export async function getJobFileContent(
  jobId: string,
  path: string
): Promise<{ content: string; path: string; name: string }> {
  const params = new URLSearchParams({ path });

  const response = await fetch(
    `${API_BASE}/api/v1/jobs/${jobId}/files/content?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to fetch file content" }));
    throw new Error(
      error.detail || `Failed to fetch file content: ${response.statusText}`
    );
  }

  return response.json();
}
