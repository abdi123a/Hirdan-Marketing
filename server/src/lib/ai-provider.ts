/**
 * ai-provider.ts
 * Scoped AI provider adapter — supports OpenAI, Anthropic (Claude), Google Gemini.
 * All providers expose the same callAI() function signature.
 * No external agent runtimes, no shell access. Pure API calls.
 */

export type AiProvider = 'openai' | 'claude' | 'gemini';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiToolParameter {
  type: string;
  description?: string;
  enum?: string[];
}

export interface AiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AiToolParameter>;
    required?: string[];
  };
}

export interface AiToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AiResponse {
  content: string;
  toolCalls?: AiToolCall[];
  provider: AiProvider;
  model: string;
}

// ─── Default model per provider ────────────────────────────────────────────
const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-pro',
};

// ─── OpenAI ────────────────────────────────────────────────────────────────
async function callOpenAI(
  apiKey: string,
  messages: AiMessage[],
  tools?: AiTool[],
  model?: string,
): Promise<AiResponse> {
  const resolvedModel = model || DEFAULT_MODELS.openai;

  const body: Record<string, unknown> = {
    model: resolvedModel,
    messages,
    temperature: 0.3,
    max_tokens: 4000,
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, any>;
    throw new Error(`OpenAI error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json() as Record<string, any>;
  const choice = data.choices?.[0];
  const message = choice?.message;

  // Tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    return {
      content: '',
      toolCalls: message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}'),
      })),
      provider: 'openai',
      model: resolvedModel,
    };
  }

  return {
    content: message?.content || '',
    provider: 'openai',
    model: resolvedModel,
  };
}

// ─── Anthropic Claude ──────────────────────────────────────────────────────
async function callClaude(
  apiKey: string,
  messages: AiMessage[],
  tools?: AiTool[],
  model?: string,
): Promise<AiResponse> {
  const resolvedModel = model || DEFAULT_MODELS.claude;

  // Anthropic separates system messages from the messages array
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: 4000,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    ...(systemMsg ? { system: systemMsg.content } : {}),
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, any>;
    throw new Error(`Claude error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json() as Record<string, any>;
  const content = data.content as any[];

  // Tool calls
  const toolUseBlocks = content?.filter((c: any) => c.type === 'tool_use') || [];
  if (toolUseBlocks.length > 0) {
    return {
      content: '',
      toolCalls: toolUseBlocks.map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        args: tc.input || {},
      })),
      provider: 'claude',
      model: resolvedModel,
    };
  }

  const textBlock = content?.find((c: any) => c.type === 'text');
  return {
    content: textBlock?.text || '',
    provider: 'claude',
    model: resolvedModel,
  };
}

// ─── Google Gemini ─────────────────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  messages: AiMessage[],
  tools?: AiTool[],
  model?: string,
): Promise<AiResponse> {
  const resolvedModel = model || DEFAULT_MODELS.gemini;

  // Gemini uses "contents" with "parts", and "user"/"model" roles (no "system" role in contents)
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
    },
    ...(systemMsg
      ? { systemInstruction: { parts: [{ text: systemMsg.content }] } }
      : {}),
  };

  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, any>;
    throw new Error(`Gemini error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json() as Record<string, any>;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Tool calls
  const funcCalls = parts.filter((p: any) => p.functionCall);
  if (funcCalls.length > 0) {
    return {
      content: '',
      toolCalls: funcCalls.map((p: any, i: number) => ({
        id: `gemini-tool-${i}`,
        name: p.functionCall.name,
        args: p.functionCall.args || {},
      })),
      provider: 'gemini',
      model: resolvedModel,
    };
  }

  const textPart = parts.find((p: any) => p.text);
  return {
    content: textPart?.text || '',
    provider: 'gemini',
    model: resolvedModel,
  };
}

// ─── Public Interface ──────────────────────────────────────────────────────

/**
 * callAI — unified entry point for all providers.
 * Dispatches to the correct adapter based on `provider`.
 */
export async function callAI(
  provider: AiProvider,
  apiKey: string,
  messages: AiMessage[],
  tools?: AiTool[],
  model?: string,
): Promise<AiResponse> {
  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, messages, tools, model);
    case 'claude':
      return callClaude(apiKey, messages, tools, model);
    case 'gemini':
      return callGemini(apiKey, messages, tools, model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * getProviderApiKey — resolves the active provider + key from AgencySettings.
 * Throws a descriptive 400 if the key is missing.
 */
export function resolveProviderKey(
  settings: Record<string, any>,
): { provider: AiProvider; apiKey: string } {
  const provider = (settings.mainAiProvider || 'openai') as AiProvider;

  const keyMap: Record<AiProvider, string | null | undefined> = {
    openai: settings.openAiApiKey,
    claude: settings.claudeApiKey,
    gemini: settings.geminiApiKey,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    const label: Record<AiProvider, string> = {
      openai: 'OpenAI',
      claude: 'Anthropic (Claude)',
      gemini: 'Google Gemini',
    };
    throw new Error(
      `${label[provider]} API key is not configured. Go to Settings → AI Settings to add it.`,
    );
  }

  return { provider, apiKey };
}

/**
 * buildToolResultMessage — feeds a tool result back into the conversation
 * so the model can generate the final response.
 */
export function buildToolResultMessage(
  provider: AiProvider,
  toolCallId: string,
  toolName: string,
  result: string,
): AiMessage {
  // All providers accept a plain text "tool result" as a user message
  // in our simplified approach (avoids provider-specific tool_result types)
  return {
    role: 'user',
    content: `[Tool: ${toolName}] Result:\n${result}`,
  };
}
