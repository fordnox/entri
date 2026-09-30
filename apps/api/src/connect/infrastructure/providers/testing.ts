/** Test-only helpers: a scriptable `fetch` stub that records requests. */

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface StubReply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Responder = (call: RecordedCall) => StubReply | undefined;

export function stubFetch(responder: Responder): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const call: RecordedCall = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    const reply = responder(call);
    if (!reply) throw new Error(`Unexpected request: ${call.method} ${call.url}`);
    const body =
      reply.body === undefined
        ? ""
        : typeof reply.body === "string"
          ? reply.body
          : JSON.stringify(reply.body);
    return new Response(body || null, { status: reply.status ?? 200, headers: reply.headers });
  };
  return { fetch: impl as typeof fetch, calls };
}

export function jsonBody(call: RecordedCall): any {
  return call.body ? JSON.parse(call.body) : undefined;
}
