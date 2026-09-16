import { STATUS_TOOL, getPandeyStatus } from "./tools/status";
import { CALCULATOR_TOOL, calculate } from "./tools/calculator";
import { WEB_SEARCH_TOOL, webSearch } from "./tools/webSearch";

interface Env {
  AI: Ai;
  PANDEY_MEMORY: DurableObjectNamespace;
  PANDEY_AUTH_TOKEN: string;
  PANDEY_DASHBOARD_PASSWORD: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

const SYSTEM_PROMPT = `
You are Pandey, a personal cloud AI assistant.

You have access to:
1. getPandeyStatus - check whether Pandey is online.
2. calculate - perform mathematical calculations.
3. webSearch - currently a placeholder and NOT connected to the live web.

Use tools when they are appropriate.

IMPORTANT:
- Never claim that you searched the live web when webSearch is only a placeholder.
- Answer clearly and naturally.
`;

const SESSION_DURATION = 60 * 60 * 1000;

const MODEL = "@cf/openai/gpt-oss-120b";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(request),
      });
    }

    /*
     * Health check
     */
    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          status: "online",
          service: "Pandey",
        },
        200,
        request,
      );
    }

    /*
     * Dashboard
     */
    if (request.method === "GET" && url.pathname === "/dashboard") {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pandey</title>
          </head>

          <body>
            <h1>Pandey is online.</h1>
            <p>Dashboard route is working.</p>
          </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            ...corsHeaders(request),
          },
        },
      );
    }

    /*
     * Dashboard login
     */
    if (
      request.method === "POST" &&
      url.pathname === "/v1/login"
    ) {
      return handleLogin(request, env);
    }

    /*
     * Chat API
     */
    if (
      request.method === "POST" &&
      url.pathname === "/v1/chat"
    ) {
      return handleChat(request, env);
    }

    return json(
      {
        error: "Not found",
      },
      404,
      request,
    );
  },
};


/*
 * Dashboard login
 */
async function handleLogin(
  request: Request,
  env: Env,
): Promise<Response> {

  let body: {
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error: "Invalid JSON.",
      },
      400,
      request,
    );
  }

  const password = body.password;

  if (!password) {
    return json(
      {
        error: "Password is required.",
      },
      400,
      request,
    );
  }

  if (password !== env.PANDEY_DASHBOARD_PASSWORD) {
    return json(
      {
        error: "Invalid password.",
      },
      401,
      request,
    );
  }

  const timestamp = Date.now().toString();

  const signature = await createSessionSignature(
    timestamp,
    env.PANDEY_DASHBOARD_PASSWORD,
  );

  const sessionToken =
    `${timestamp}.${signature}`;

  return json(
    {
      success: true,
      session_token: sessionToken,
      expires_in: SESSION_DURATION / 1000,
    },
    200,
    request,
  );
}


/*
 * Chat handler
 */
async function handleChat(
  request: Request,
  env: Env,
): Promise<Response> {

  /*
   * Authentication
   *
   * Accept either:
   * 1. Existing permanent API token
   * 2. Temporary dashboard session token
   */

  const authorization =
    request.headers.get("Authorization");

  let authenticated = false;

  /*
   * Existing API authentication
   */
  if (
    authorization &&
    authorization.startsWith("Bearer ")
  ) {

    const token =
      authorization.substring(7);

    if (token === env.PANDEY_AUTH_TOKEN) {
      authenticated = true;
    }

    /*
     * Dashboard session authentication
     */
    if (!authenticated) {
      authenticated =
        await verifySessionToken(
          token,
          env.PANDEY_DASHBOARD_PASSWORD,
        );
    }
  }

  if (!authenticated) {
    return json(
      {
        error: "Unauthorized",
      },
      401,
      request,
    );
  }

  /*
   * Read request
   */
  let body: {
    conversation_id?: string;
    message?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error: "Invalid JSON.",
      },
      400,
      request,
    );
  }

  const conversationId =
    body.conversation_id ||
    crypto.randomUUID();

  const message =
    body.message?.trim();

  if (!message) {
    return json(
      {
        error: "Message is required.",
      },
      400,
      request,
    );
  }

  /*
   * Get Durable Object memory
   */
  const id =
    env.PANDEY_MEMORY.idFromName(
      conversationId,
    );

  const memory =
    env.PANDEY_MEMORY.get(id);

  const memoryResponse =
    await memory.fetch(
      new Request(
        "https://memory/history",
      ),
    );

  const memoryData =
    await memoryResponse.json() as {
      history?: ChatMessage[];
    };

  const history: ChatMessage[] =
    memoryData.history || [];

  /*
   * Add system prompt
   */
  if (history.length === 0) {
    history.push({
      role: "system",
      content: SYSTEM_PROMPT,
    });
  }

  /*
   * Add user message
   */
  history.push({
    role: "user",
    content: message,
  });

  /*
   * First AI call
   */
  let firstResult: any;

  try {
    firstResult =
      await env.AI.run(
        MODEL,
        {
          messages: history,
          tools: [
            STATUS_TOOL,
            CALCULATOR_TOOL,
            WEB_SEARCH_TOOL,
          ],
        },
      );

    console.log(
      "AI FIRST RESULT KEYS:",
      Object.keys(firstResult || {}),
    );

    console.log(
      "AI FIRST RESULT TYPES:",
      describeAIResult(firstResult),
    );

  } catch (error) {

    console.error(
      "AI FIRST CALL ERROR:",
      safeError(error),
    );

    return json(
      {
        error: "AI model request failed.",
        details: safeError(error),
      },
      502,
      request,
    );
  }

  /*
   * Check for tool calls
   */
  const toolCalls =
    Array.isArray(firstResult?.tool_calls)
      ? firstResult.tool_calls
      : [];

  if (toolCalls.length > 0) {

    const toolCall =
      toolCalls[0];

    const toolName =
      toolCall.function?.name ||
      toolCall.name;

    let toolResult: unknown;

    try {

      const rawArguments =
        toolCall.function?.arguments ??
        toolCall.arguments ??
        "{}";

      const args =
        typeof rawArguments === "string"
          ? JSON.parse(rawArguments)
          : rawArguments;

      if (toolName === "getPandeyStatus") {

        toolResult =
          await getPandeyStatus();

      } else if (toolName === "calculate") {

        toolResult =
          await calculate(
            args.expression,
          );

      } else if (toolName === "webSearch") {

        toolResult =
          await webSearch(
            args.query,
          );

      } else {

        toolResult = {
          success: false,
          error:
            `Unknown tool: ${toolName}`,
        };
      }

    } catch (error) {

      console.error(
        "TOOL EXECUTION ERROR:",
        safeError(error),
      );

      toolResult = {
        success: false,
        error:
          "Tool execution failed.",
      };
    }

    /*
     * Tool call message
     */
    const toolCallMessage: ChatMessage = {
      role: "assistant",
      content: JSON.stringify({
        name: toolName,
        arguments:
          toolCall.function?.arguments ||
          toolCall.arguments ||
          "{}",
      }),
    };

    /*
     * Tool result
     */
    const toolResultMessage: ChatMessage = {
      role: "tool",
      content: JSON.stringify(
        toolResult,
      ),
      tool_call_id:
        toolCall.id,
      name: toolName,
    };

    /*
     * Second AI call
     */
    const secondMessages:
      ChatMessage[] = [
        ...history,
        toolCallMessage,
        toolResultMessage,
      ];

    let secondResult: any;

    try {

      secondResult =
        await env.AI.run(
          MODEL,
          {
            messages: secondMessages,
          },
        );

      console.log(
        "AI SECOND RESULT KEYS:",
        Object.keys(secondResult || {}),
      );

      console.log(
        "AI SECOND RESULT TYPES:",
        describeAIResult(secondResult),
      );

    } catch (error) {

      console.error(
        "AI SECOND CALL ERROR:",
        safeError(error),
      );

      return json(
        {
          error: "AI model failed after tool execution.",
          details: safeError(error),
        },
        502,
        request,
      );
    }

    const finalReply =
      extractReply(secondResult);

    if (!finalReply) {

      console.error(
        "AI SECOND RESULT COULD NOT BE EXTRACTED:",
        safeDebugResult(secondResult),
      );

      return json(
        {
          error:
            "AI model returned an unsupported response format.",
        },
        502,
        request,
      );
    }

    /*
     * Save conversation
     */
    history.push(
      toolCallMessage,
      toolResultMessage,
      {
        role: "assistant",
        content: finalReply,
      },
    );

    await memory.fetch(
      new Request(
        "https://memory/history",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            history,
          }),
        },
      ),
    );

    return json(
      {
        conversation_id:
          conversationId,
        reply: finalReply,
        tool_used: true,
        tool: toolName,
      },
      200,
      request,
    );
  }

  /*
   * No tool required
   */
  const finalReply =
    extractReply(firstResult);

  if (!finalReply) {

    console.error(
      "AI FIRST RESULT COULD NOT BE EXTRACTED:",
      safeDebugResult(firstResult),
    );

    return json(
      {
        error:
          "AI model returned an unsupported response format.",
      },
      502,
      request,
    );
  }

  history.push({
    role: "assistant",
    content: finalReply,
  });

  await memory.fetch(
    new Request(
      "https://memory/history",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          history,
        }),
      },
    ),
  );

  return json(
    {
      conversation_id:
        conversationId,
      reply: finalReply,
      tool_used: false,
    },
    200,
    request,
  );
}


/*
 * Extract model response safely
 */
function extractReply(
  result: any,
): string | null {

  if (typeof result === "string") {
    return result.trim() || null;
  }

  /*
   * Standard Workers AI response
   */
  if (typeof result?.response === "string") {
    return result.response.trim() || null;
  }

  /*
   * Some response formats expose content directly
   */
  if (typeof result?.content === "string") {
    return result.content.trim() || null;
  }

  /*
   * Nested response
   */
  if (typeof result?.result?.response === "string") {
    return result.result.response.trim() || null;
  }

  if (typeof result?.result?.content === "string") {
    return result.result.content.trim() || null;
  }

  /*
   * OpenAI-style chat completion response
   */
  if (
    typeof result?.choices?.[0]?.message?.content ===
    "string"
  ) {
    return result.choices[0].message.content.trim() || null;
  }

  /*
   * OpenAI-style response output text
   */
  if (
    typeof result?.output_text === "string"
  ) {
    return result.output_text.trim() || null;
  }

  /*
   * Responses API style output
   */
  if (Array.isArray(result?.output)) {

    for (const item of result.output) {

      if (
        typeof item?.content === "string"
      ) {
        return item.content.trim() || null;
      }

      if (Array.isArray(item?.content)) {

        for (const contentItem of item.content) {

          if (
            typeof contentItem?.text === "string"
          ) {
            return contentItem.text.trim() || null;
          }
        }
      }
    }
  }

  return null;
}


/*
 * Describe AI result without exposing
 * the actual response text.
 */
function describeAIResult(
  result: any,
): Record<string, unknown> {

  return {
    type: typeof result,

    hasResponse:
      typeof result?.response !== "undefined",

    responseType:
      typeof result?.response,

    hasContent:
      typeof result?.content !== "undefined",

    contentType:
      typeof result?.content,

    hasToolCalls:
      Array.isArray(result?.tool_calls),

    toolCallCount:
      Array.isArray(result?.tool_calls)
        ? result.tool_calls.length
        : 0,

    hasChoices:
      Array.isArray(result?.choices),

    choiceCount:
      Array.isArray(result?.choices)
        ? result.choices.length
        : 0,

    hasOutput:
      Array.isArray(result?.output),

    outputCount:
      Array.isArray(result?.output)
        ? result.output.length
        : 0,
  };
}


/*
 * Safe debugging information.
 *
 * This deliberately does NOT print:
 * - passwords
 * - authentication tokens
 * - conversation contents
 */
function safeDebugResult(
  result: any,
): Record<string, unknown> {

  return {
    keys:
      result && typeof result === "object"
        ? Object.keys(result)
        : [],

    description:
      describeAIResult(result),
  };
}


/*
 * Safe error formatting
 */
function safeError(
  error: unknown,
): string {

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}


/*
 * Create temporary dashboard session signature
 */
async function createSessionSignature(
  timestamp: string,
  password: string,
): Promise<string> {

  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(timestamp),
    );

  return arrayBufferToBase64Url(
    signature,
  );
}


/*
 * Verify temporary dashboard session
 */
async function verifySessionToken(
  token: string,
  password: string,
): Promise<boolean> {

  try {

    const parts =
      token.split(".");

    if (parts.length !== 2) {
      return false;
    }

    const timestamp =
      Number(parts[0]);

    const signature =
      parts[1];

    if (!Number.isFinite(timestamp)) {
      return false;
    }

    /*
     * Reject expired sessions
     */
    const age =
      Date.now() - timestamp;

    if (
      age < 0 ||
      age > SESSION_DURATION
    ) {
      return false;
    }

    const expectedSignature =
      await createSessionSignature(
        timestamp.toString(),
        password,
      );

    return timingSafeEqual(
      signature,
      expectedSignature,
    );

  } catch {

    return false;
  }
}


/*
 * Timing-safe string comparison
 */
function timingSafeEqual(
  a: string,
  b: string,
): boolean {

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}


/*
 * Base64 URL encoding
 */
function arrayBufferToBase64Url(
  buffer: ArrayBuffer,
): string {

  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


/*
 * JSON helper
 */
function json(
  data: unknown,
  status = 200,
  request?: Request,
): Response {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        ...corsHeaders(request),
      },
    },
  );
}


/*
 * CORS
 */
function corsHeaders(
  request?: Request,
): HeadersInit {

  const origin =
    request?.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin":
      origin || "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",

    "Vary":
      "Origin",
  };
}


/*
 * Durable Object memory
 */
export class PandeyMemory {

  private state:
    DurableObjectState;

  constructor(
    state: DurableObjectState,
    env: Env,
  ) {
    this.state = state;
  }

  async fetch(
    request: Request,
  ): Promise<Response> {

    const url =
      new URL(request.url);

    /*
     * Get history
     */
    if (
      request.method === "GET" &&
      url.pathname === "/history"
    ) {

      const history =
        (await this.state.storage.get<
          ChatMessage[]
        >("history")) || [];

      return json({
        history,
      });
    }

    /*
     * Save history
     */
    if (
      request.method === "POST" &&
      url.pathname === "/history"
    ) {

      const body =
        await request.json() as {
          history?: ChatMessage[];
        };

      await this.state.storage.put(
        "history",
        body.history || [],
      );

      return json({
        success: true,
      });
    }

    return json(
      {
        error: "Not found",
      },
      404,
    );
  }
}