import "dotenv/config";
// Configure global undici proxy BEFORE importing Better Auth
// This ensures all undici requests (including Better Auth's internal requests) use the proxy
import "./undici-proxy-setup";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { customFetch } from "./custom-fetch";


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Process connection string
// Note: For Transaction mode (port 6543), we keep the connection string as-is
// For Direct connection, we may strip query params
const rawDbUrl = process.env.DATABASE_URL || "";
let connectionString = rawDbUrl;
try {
  const u = new URL(rawDbUrl);
  // For Transaction mode (port 6543), keep query params if present
  // For Direct connection (port 5432), strip query params
  const port = u.port || (u.protocol === 'postgresql:' || u.protocol === 'postgres:' ? '5432' : '');
  if (port === '6543' || port === '5432') {
    // Transaction mode or Session mode - keep query params (like pgbouncer=true)
    connectionString = rawDbUrl;
  } else {
    // Direct connection - strip query params
    u.search = "";
    connectionString = u.toString();
  }
} catch {
  // keep as-is if URL parsing fails
  connectionString = rawDbUrl;
}

// Rely on Better Auth's official CLI migration for schema.

// Validate database connection string format
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const port = dbUrl.port || '5432';
    const hostname = dbUrl.hostname;
    const username = dbUrl.username;
    
    let isValid = false;
    
    if (port === '6543') {
      isValid = (hostname.includes('pooler.supabase.com') && username.includes('.')) ||
                (hostname.includes('db.') && hostname.includes('.supabase.co') && username === 'postgres');
    } else if (port === '5432') {
      isValid = (hostname.includes('db.') && hostname.includes('.supabase.co') && username === 'postgres') ||
                (hostname.includes('pooler.supabase.com') && username.includes('.'));
    }
    
    if (!isValid && port === '6543') {
      console.warn("⚠️  Transaction Mode Connection String Format may be incorrect");
    }
  } catch {
    // ignore URL parsing errors
  }
}

// Build trusted origins from env + sensible defaults
const defaultTrustedOrigins = [
  // Dev
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Prod (can be overridden/extended via env)
  "https://trykimu.com",
  "https://www.trykimu.com",
];

const envTrustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const trustedOrigins = Array.from(
  new Set([...defaultTrustedOrigins, ...envTrustedOrigins])
);

// Create database pool with enhanced error handling
const dbPool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase.co') 
    ? { rejectUnauthorized: false } // Supabase uses certificates that may not be trusted by Node.js
    : process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  // Add connection pool settings to handle network issues
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 60000, // Close idle clients after 60 seconds
  connectionTimeoutMillis: 60000, // Increased to 60 seconds for Transaction mode (network may be slow)
  // Retry configuration
  allowExitOnIdle: false,
  // Don't connect immediately - let Better Auth connect when needed
  // This avoids DNS resolution issues during module loading
});

// Handle pool errors gracefully with detailed logging
dbPool.on('error', (err: any) => {
  console.error('❌ Database pool error:', err.message);
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
    console.error('   DNS resolution failed for:', err.hostname || 'unknown hostname');
    console.error('   Error code:', err.code);
    console.error('   This usually means:');
    console.error('   1. DNS server cannot resolve the hostname');
    console.error('   2. Network connection issue');
    console.error('   3. Proxy/firewall blocking DNS resolution');
    console.error('   Solutions:');
    console.error('   - Check your network connection');
    console.error('   - Configure Clash to allow Supabase DNS resolution');
    console.error('   - Try using a different DNS server (8.8.8.8)');
    console.error('   - The connection will be retried automatically');
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    console.error('   Connection timeout or refused');
    console.error('   This may be a temporary network issue');
    console.error('   The connection will be retried automatically');
  }
});


// Test database connection on startup (non-blocking)
// This helps identify connection issues early
if (process.env.NODE_ENV === "development") {
  (async () => {
    try {
      // Wait a bit for DNS to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const client = await dbPool.connect();
      client.release();
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
        console.warn('⚠️  Database connection test failed (DNS):', err.message);
        console.warn('   This may be a temporary DNS issue. Connection will be retried when needed.');
      } else {
        console.warn('⚠️  Database connection test failed:', err.message);
        console.warn('   Connection will be retried when needed.');
      }
    }
  })();
}

export const auth = betterAuth({
  basePath: "/api/auth",
  // Force baseURL in development so Google gets the correct redirect_uri
  baseURL:
    process.env.AUTH_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : undefined),
  // Trust proxy headers to detect HTTPS for secure cookies
  trustProxy: process.env.NODE_ENV === "production",
  // Let Better Auth auto-detect baseURL from the request
  database: dbPool,

  // Use custom fetch with proxy support and increased timeout
  // This will be used by Better Auth for external API calls (e.g., Google OAuth)
  fetch: customFetch,

  // Add debugging and callback configuration
  logger: {
    level: "debug",
  },

  socialProviders: {
    ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        // Let Better Auth use its default callback endpoint
        // redirectURI will be automatically set to: {baseURL}/api/auth/callback/google
        // Explicitly set redirectURI if needed (Better Auth will auto-detect from baseURL)
        redirectURI: process.env.AUTH_BASE_URL 
          ? `${process.env.AUTH_BASE_URL}/api/auth/callback/google`
          : process.env.NODE_ENV === "development"
            ? "http://localhost:5173/api/auth/callback/google"
            : undefined,
      },
    } : {}),
  },
  session: {
    // Increase session expiry
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookie: {
      // Use "lax" for same-site requests, "none" only needed for cross-origin
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "none",
      secure: process.env.NODE_ENV === "production",
      // In production, pin cookie domain to apex so subdomains (if any) share
      // Set via env if provided, else let browser infer from host header
      ...(process.env.AUTH_COOKIE_DOMAIN
        ? { domain: process.env.AUTH_COOKIE_DOMAIN }
        : {}),
      path: "/",
    },
  },
  // Trusted origins for CORS and cookies
  trustedOrigins,
});
// Schema is managed via CLI migrations.
