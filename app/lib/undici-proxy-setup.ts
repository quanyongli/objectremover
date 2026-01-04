/**
 * Global undici proxy configuration
 * This sets up undici to use proxy for all HTTP/HTTPS requests
 * This is needed because Better Auth uses @better-fetch/fetch which doesn't respect custom fetch
 */

import { setGlobalDispatcher, ProxyAgent } from "undici";

// Get proxy configuration from environment variables
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;

if (HTTP_PROXY || HTTPS_PROXY) {
  try {
    // Use HTTPS_PROXY if available, otherwise fall back to HTTP_PROXY
    const proxyUrl = HTTPS_PROXY || HTTP_PROXY;
    
    if (proxyUrl) {
      // Create a global proxy agent for undici
      const proxyAgent = new ProxyAgent({ uri: proxyUrl });
      
      setGlobalDispatcher(proxyAgent);
    }
  } catch (error: any) {
    console.error("❌ Failed to configure global undici proxy:", error.message || error);
  }
}

