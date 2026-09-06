import type {
  QueryRequest,
  QueryResponse,
  StreamDoneData,
  TranscribeResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/**
 * Streaming answers should surface tokens within a few seconds. Keep the
 * client timeout above the backend's per-call Groq budget (15s) and
 * retrieval stage (30s) but well below the old 90s blocking /query path.
 */
const STREAM_TIMEOUT_MS = 45_000;
const BLOCKING_TIMEOUT_MS = 45_000;

/** Appended on "Retry with Fast Route" — steers the backend toward a
 * clarifying question instead of digesting the full patent corpus. */
export const FAST_ROUTE_HINT =
  " [Fast route: ask one clarifying question about formulation type (Classical vs P&P vs phytopharmaceutical) rather than summarizing the full patent corpus.]";

export class ApiError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

export class ClientTimeoutError extends Error {
  retryable = true;
  constructor() {
    super(
      "The LLM provider took too long to respond. Try again with Fast Route for a quicker clarifying answer."
    );
    this.name = "ClientTimeoutError";
  }
}

export function isTimeoutError(err: unknown): boolean {
  if (err instanceof ClientTimeoutError) return true;
  if (err instanceof ApiError) {
    return (
      err.retryable ||
      err.status === 504 ||
      /exceeded|timed out|too long/i.test(err.message)
    );
  }
  return false;
}

async function extractErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          d?.msg ? `${(d.loc ?? []).join(".")}: ${d.msg}` : JSON.stringify(d)
        )
        .join("; ");
    }
    return res.statusText || `Request failed with status ${res.status}`;
  } catch {
    return res.statusText || `Request failed with status ${res.status}`;
  }
}

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function buildQueryBody(req: QueryRequest) {
  return {
    question: req.question,
    history: req.history ?? [],
    jurisdiction: req.jurisdiction ?? "india",
    language: req.language ?? "en-IN",
    synthesize_audio: req.synthesize_audio ?? false,
  };
}

export async function query(req: QueryRequest): Promise<QueryResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BLOCKING_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildQueryBody(req)),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ClientTimeoutError();
    }
    throw new ApiError(
      "Could not reach the backend. Is it running at " + API_BASE_URL + "?",
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new ApiError(detail, res.status, res.status === 504);
  }

  return (await res.json()) as QueryResponse;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (data: StreamDoneData) => void;
}

function parseSseBlock(block: string): { event: string | null; data: string } {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
  }
  return { event, data: dataLines.join("\n") };
}

export async function queryStream(
  req: QueryRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/query/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildQueryBody(req)),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ClientTimeoutError();
    }
    throw new ApiError(
      "Could not reach the backend. Is it running at " + API_BASE_URL + "?",
      0
    );
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeoutId);
    const detail = await extractErrorDetail(res);
    throw new ApiError(detail, res.status, res.status === 504);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneReceived = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const rawBlock = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const { event, data } = parseSseBlock(rawBlock);
        if (!event || !data) continue;

        if (event === "token") {
          const parsed = JSON.parse(data) as { text?: string };
          if (parsed.text) callbacks.onToken(parsed.text);
        } else if (event === "done") {
          doneReceived = true;
          callbacks.onDone(JSON.parse(data) as StreamDoneData);
        } else if (event === "error") {
          const parsed = JSON.parse(data) as { detail?: string };
          const detail = parsed.detail ?? "Streaming request failed.";
          throw new ApiError(detail, 504, /exceeded|timed out|too long/i.test(detail));
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!doneReceived) {
    throw new ApiError(
      "The stream ended before a final answer arrived — the connection may have dropped.",
      0,
      true
    );
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  filename: string,
  languageCode: string = "unknown"
): Promise<TranscribeResponse> {
  const form = new FormData();
  form.append("file", audioBlob, filename);
  form.append("language_code", languageCode);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BLOCKING_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/voice/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ClientTimeoutError();
    }
    throw new ApiError(
      "Could not reach the backend for transcription. Is it running at " +
        API_BASE_URL +
        "?",
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await extractErrorDetail(res);
    throw new ApiError(detail, res.status);
  }

  return (await res.json()) as TranscribeResponse;
}

export function sourceUrl(sourceFile: string, page?: number): string {
  const base = `${API_BASE_URL}/sources/${encodeURIComponent(sourceFile)}`;
  return page ? `${base}#page=${page}` : base;
}

export { API_BASE_URL };
