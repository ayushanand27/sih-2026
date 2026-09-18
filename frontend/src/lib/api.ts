import type {
  QueryRequest,
  QueryResponse,
  StreamDoneData,
  TranscribeResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const STREAM_TIMEOUT_MS = 68_000;
const BLOCKING_TIMEOUT_MS = 68_000;

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
      "The request took longer than 68 seconds without a response — the backend may be unreachable or overloaded."
    );
    this.name = "ClientTimeoutError";
  }
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      "The backend isn't configured yet — set NEXT_PUBLIC_API_BASE_URL to your backend URL (see .env.local.example)."
    );
    this.name = "ApiNotConfiguredError";
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

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
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
    throw new ApiError(`Could not reach the backend at ${API_BASE_URL}.`, 0);
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

async function _openStreamResponse(
  req: QueryRequest,
  controller: AbortController
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/query/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildQueryBody(req)),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ClientTimeoutError();
    }
    throw new ApiError(`Could not reach the backend at ${API_BASE_URL}.`, 0);
  }

  if (!res.ok || !res.body) {
    const detail = await extractErrorDetail(res);
    throw new ApiError(detail, res.status, res.status === 504);
  }
  return res;
}

function _dispatchSseFrame(rawBlock: string, callbacks: StreamCallbacks): boolean {
  const { event, data } = parseSseBlock(rawBlock);
  if (!event || !data) return false;

  if (event === "token") {
    const parsed = JSON.parse(data) as { text?: string };
    if (parsed.text) callbacks.onToken(parsed.text);
    return false;
  }
  if (event === "done") {
    callbacks.onDone(JSON.parse(data) as StreamDoneData);
    return true;
  }
  if (event === "error") {
    const parsed = JSON.parse(data) as { detail?: string };
    const detail = parsed.detail ?? "Streaming request failed.";
    throw new ApiError(detail, 504, /exceeded|timed out|too long/i.test(detail));
  }
  return false;
}

export async function queryStream(
  req: QueryRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let res: Response;
  try {
    res = await _openStreamResponse(req, controller);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
  if (!res.body) {
    clearTimeout(timeoutId);
    throw new ApiError("Streaming response had no body.", 0);
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
        if (_dispatchSseFrame(rawBlock, callbacks)) {
          doneReceived = true;
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
      `Could not reach the backend for transcription at ${API_BASE_URL}.`,
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
