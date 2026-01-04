/**
 * Custom fetch function for Better Auth that supports:
 * 1. Proxy configuration via environment variables
 * 2. Increased timeout for slow networks
 * 3. Better error handling
 */

import { fetch as undiciFetch, Agent, ProxyAgent } from "undici";

// Get proxy configuration from environment variables
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const NO_PROXY = process.env.NO_PROXY || process.env.no_proxy || "";

// Parse NO_PROXY to check if a host should bypass proxy
const noProxyHosts = NO_PROXY.split(",").map((h) => h.trim().toLowerCase());

// Check if a URL should bypass proxy
function shouldBypassProxy(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return noProxyHosts.some((noProxyHost) => {
    if (noProxyHost.startsWith(".")) {
      return hostname.endsWith(noProxyHost) || hostname === noProxyHost.slice(1);
    }
    return hostname === noProxyHost;
  });
}

// Create undici Agent with proxy support
function createAgent(url: URL): Agent | ProxyAgent | undefined {
  // If no proxy is configured, return undefined (use default)
  if (!HTTP_PROXY && !HTTPS_PROXY) {
    return undefined;
  }

  // Check if we should bypass proxy
  if (shouldBypassProxy(url)) {
    return undefined;
  }

  // Determine which proxy to use
  const proxyUrl = url.protocol === "https:" ? HTTPS_PROXY || HTTP_PROXY : HTTP_PROXY;
  
  if (!proxyUrl) {
    return undefined;
  }

  try {
    return new ProxyAgent({ uri: proxyUrl });
  } catch {
    return undefined;
  }
}

/**
 * Custom fetch function with proxy support and increased timeout
 */
export async function customFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" 
    ? new URL(input) 
    : input instanceof URL 
      ? input 
      : typeof input === "object" && "url" in input
        ? new URL(input.url)
        : new URL(String(input));
  
  const agent = createAgent(url);
  const timeout = 30000; // 30 seconds (increased from default 10 seconds)
  
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const fetchInput = typeof input === "string" || input instanceof URL 
      ? String(input)
      : input instanceof Request
        ? input.url
        : String(input);
    
    const response = await undiciFetch(fetchInput as any, {
      ...init,
      dispatcher: agent,
      signal: controller.signal,
    } as any);
    
    if (timeoutId) clearTimeout(timeoutId);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as HeadersInit,
    });
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (error.name === "AbortError" || error.code === "UND_ERR_CONNECT_TIMEOUT") {
      const errorMsg = new Error(
        `Request timeout after ${timeout}ms. This might be due to network issues or proxy configuration.`
      );
      (errorMsg as any).cause = error;
      throw errorMsg;
    }
    
    throw error;
  }
}


