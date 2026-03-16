export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
}

export interface HttpClient {
  request(method: string, path: string, options?: RequestOptions): Promise<unknown>;
}

export class FetchHttpClient implements HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {},
  ) {}

  async request(method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...this.defaultHeaders,
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when calling ${method} ${path}`);
    }

    if (response.status === 204) {
      return undefined;
    }

    return response.json();
  }
}
