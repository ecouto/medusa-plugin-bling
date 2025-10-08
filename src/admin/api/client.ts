export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers" | "credentials"> & {
  body?: unknown;
  headers?: HeadersInit;
  /**
   * When true, the request body will be JSON-stringified automatically.
   * By default, the helper stringifies plain objects.
   */
  json?: boolean;
};

const ensureJsonHeaders = (headers: Headers) => {
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
};

const parseResponseBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text as unknown as T;
};

const buildRequestInit = (input?: RequestOptions): RequestInit => {
  const init: RequestInit = {
    credentials: "include",
  };

  if (!input) {
    return init;
  }

  const { headers, body, json, ...rest } = input;
  Object.assign(init, rest);

  const normalizedHeaders = new Headers(headers);

  if (json === true) {
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    ensureJsonHeaders(normalizedHeaders);
  } else if (body !== undefined) {
    init.body = body as BodyInit | null;
  }

  if (normalizedHeaders.keys().next().done === false) {
    init.headers = normalizedHeaders;
  }

  return init;
};

export const request = async <T>(path: string, options?: RequestOptions): Promise<T> => {
  const init = buildRequestInit(options);
  const response = await fetch(path, init);

  if (!response.ok) {
    let message = `Request to ${path} failed`;
    let details: unknown;

    try {
      details = await parseResponseBody(response);
      if (
        details &&
        typeof details === "object" &&
        "message" in details &&
        typeof (details as { message: unknown }).message === "string"
      ) {
        message = (details as { message: string }).message;
      } else if (typeof details === "string" && details.trim().length > 0) {
        message = details;
      }
    } catch {
      // fall through, we already have a default message
    }

    throw new ApiError(message, response.status, details);
  }

  return parseResponseBody<T>(response);
};
