import https from "node:https";
import http from "node:http";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  proxy?: string | null;
  timeout?: number;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30000;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await this.doRequest<T>(method, url, body);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const status = (lastError as any).status;
        if (status && status !== 429 && status < 500) throw lastError;

        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError ?? new Error("Request failed");
  }

  private doRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;

      const postData = body ? JSON.stringify(body) : undefined;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.apiKey,
            ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
          },
          timeout: this.timeout,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              try {
                resolve(JSON.parse(data) as T);
              } catch {
                resolve(data as unknown as T);
              }
            } else {
              const err = new Error(`HTTP ${status}: ${data}`);
              (err as any).status = status;
              reject(err);
            }
          });
        }
      );

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
      if (postData) req.write(postData);
      req.end();
    });
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
}
