"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchHttpClient = void 0;
class FetchHttpClient {
    constructor(baseUrl, defaultHeaders = {}) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = defaultHeaders;
    }
    async request(method, path, options = {}) {
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
exports.FetchHttpClient = FetchHttpClient;
