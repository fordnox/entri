import type {
  AutomateConfigurationRequest,
  CheckDomainRequest,
  CheckDomainResponse,
  ConnectApplicationPublicDTO,
  CreateConfigurationRequest,
  DomainConnectionDTO,
} from "@orbit/shared/connect";

/** Error raised for any failed Connect API call. `code` mirrors the API's `error.code`. */
export class ConnectApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ConnectApiError";
    this.code = code;
    this.status = status;
  }
}

/** Codes after which continuing the flow makes no sense. */
export const FATAL_CODES = new Set([
  "token.invalid",
  "token.expired",
  "origin_not_allowed",
  "dns_records.invalid",
]);

export interface ConnectApi {
  getApplication(): Promise<ConnectApplicationPublicDTO>;
  checkDomain(body: CheckDomainRequest): Promise<CheckDomainResponse>;
  createConfiguration(body: CreateConfigurationRequest): Promise<DomainConnectionDTO>;
  getConfiguration(id: string): Promise<DomainConnectionDTO>;
  automate(id: string, body: AutomateConfigurationRequest): Promise<DomainConnectionDTO>;
  markManual(id: string): Promise<DomainConnectionDTO>;
  verify(id: string): Promise<DomainConnectionDTO>;
}

export function createApi(apiOrigin: string, token: string): ConnectApi {
  async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${apiOrigin}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        mode: "cors",
      });
    } catch {
      throw new ConnectApiError(
        "network",
        "We couldn't reach the server. Check your connection and try again.",
        0,
      );
    }

    const text = await res.text().catch(() => "");
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }

    if (!res.ok) {
      const err = (data as { error?: { code?: unknown; message?: unknown } } | undefined)?.error;
      const code = typeof err?.code === "string" ? err.code : `http_${res.status}`;
      const message =
        typeof err?.message === "string" && err.message
          ? err.message
          : `Request failed (${res.status}).`;
      throw new ConnectApiError(code, message, res.status);
    }
    return data as T;
  }

  const cfg = (id: string) => `/v1/connect/configurations/${encodeURIComponent(id)}`;

  return {
    getApplication: () => request("GET", "/v1/connect/application"),
    checkDomain: (body) => request("POST", "/v1/connect/domains/check", body),
    createConfiguration: (body) => request("POST", "/v1/connect/configurations", body),
    getConfiguration: (id) => request("GET", cfg(id)),
    automate: (id, body) => request("POST", `${cfg(id)}/automate`, body),
    markManual: (id) => request("POST", `${cfg(id)}/manual`, {}),
    verify: (id) => request("POST", `${cfg(id)}/verify`, {}),
  };
}
