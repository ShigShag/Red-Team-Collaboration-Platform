import { getSetting } from "@/lib/platform-settings";

// ── Types ────────────────────────────────────────────────────────

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaToolDefinition[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaStreamChunk {
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
}

// ── Config ───────────────────────────────────────────────────────

async function getConfig() {
  const baseUrl = await getSetting("ollama_base_url");
  const model = await getSetting("ollama_model");
  return { baseUrl: baseUrl.replace(/\/$/, ""), model };
}

export async function isOllamaConfigured(): Promise<boolean> {
  const { baseUrl } = await getConfig();
  return baseUrl.length > 0;
}

export async function getFindingModel(): Promise<string> {
  const findingModel = await getSetting("ollama_finding_model");
  if (findingModel) return findingModel;
  const { model } = await getConfig();
  return model;
}

// ── Client Functions ─────────────────────────────────────────────

export async function ollamaChat(
  messages: OllamaMessage[],
  tools?: OllamaToolDefinition[],
  modelOverride?: string
): Promise<ReadableStream<Uint8Array>> {
  const { baseUrl, model } = await getConfig();
  if (!baseUrl) throw new Error("Ollama is not configured");

  const body: OllamaChatRequest = {
    model: modelOverride || model,
    messages,
    stream: true,
    options: { temperature: 0.3 },
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error("No response body from Ollama");
  }

  return response.body;
}

export async function ollamaChatSync(
  messages: OllamaMessage[]
): Promise<OllamaMessage> {
  const { baseUrl, model } = await getConfig();
  if (!baseUrl) throw new Error("Ollama is not configured");

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: 0.3, num_predict: 100 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}`);
  }

  const data = (await response.json()) as { message: OllamaMessage };
  return data.message;
}

export async function ollamaHealthCheck(): Promise<boolean> {
  const { baseUrl } = await getConfig();
  if (!baseUrl) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ── Stream Parser ────────────────────────────────────────────────

export async function* parseOllamaStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<OllamaStreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as OllamaStreamChunk;
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim()) as OllamaStreamChunk;
      } catch {
        // Skip
      }
    }
  } finally {
    reader.releaseLock();
  }
}
