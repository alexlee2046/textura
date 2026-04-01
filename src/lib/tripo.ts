const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

function getApiKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error("TRIPO_API_KEY is not configured");
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .catch((err) => {
      if (err?.name === "AbortError") {
        throw new Error(`Tripo API request timed out after ${timeoutMs}ms`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export async function tripoUploadImage(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
  );

  const resp = await fetchWithTimeout(
    `${TRIPO_BASE}/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getApiKey()}` },
      body: formData,
    },
    60_000,
  );

  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`Tripo upload failed: ${data.message ?? JSON.stringify(data)}`);
  }
  return data.data.image_token;
}

interface CreateTaskOptions {
  imageToken: string;
  imageToken2?: string;
  smartLowPoly?: boolean;
  autoScale?: boolean;
}

export async function tripoCreateTask(
  mode: "quick" | "precision",
  options: CreateTaskOptions,
): Promise<string> {
  const body: Record<string, unknown> =
    mode === "precision" && options.imageToken2
      ? {
          type: "multiview_to_model",
          files: [
            { type: "png", file_token: options.imageToken },
            { type: "png", file_token: options.imageToken2 },
          ],
        }
      : {
          type: "image_to_model",
          file: { type: "png", file_token: options.imageToken },
        };

  if (options.smartLowPoly !== false) body.smart_low_poly = true;
  if (options.autoScale !== false) body.auto_scale = true;

  const resp = await fetchWithTimeout(
    `${TRIPO_BASE}/task`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    },
    30_000,
  );

  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`Tripo task creation failed: ${data.message ?? JSON.stringify(data)}`);
  }
  return data.data.task_id;
}

export interface TripoTaskStatus {
  status: "queued" | "running" | "success" | "failed";
  progress: number;
  modelUrl?: string;
  consumedCredit?: number;
}

export async function tripoGetStatus(taskId: string): Promise<TripoTaskStatus> {
  const resp = await fetchWithTimeout(
    `${TRIPO_BASE}/task/${taskId}`,
    { headers: headers() },
    30_000,
  );

  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`Tripo status check failed: ${data.message ?? JSON.stringify(data)}`);
  }

  const task = data.data;
  return {
    status: task.status,
    progress: task.progress ?? 0,
    modelUrl: task.result?.pbr_model?.url ?? task.output?.pbr_model,
    consumedCredit: task.consumed_credit,
  };
}

/** Stream-based download -- avoids buffering the entire GLB in memory. */
export async function tripoDownloadAsStream(
  url: string,
): Promise<{ body: ReadableStream<Uint8Array>; contentLength: number | undefined }> {
  const resp = await fetchWithTimeout(url, {}, 120_000);
  if (!resp.ok) {
    throw new Error(`Failed to download model stream: HTTP ${resp.status}`);
  }
  if (!resp.body) {
    throw new Error("Response has no body stream");
  }
  const cl = resp.headers.get("content-length");
  return {
    body: resp.body,
    contentLength: cl ? parseInt(cl, 10) : undefined,
  };
}
