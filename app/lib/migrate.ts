import "dotenv/config";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

async function run() {
  const rawDbUrl = process.env.DATABASE_URL || "";
  let connectionString = rawDbUrl;
  try {
    const u = new URL(rawDbUrl);
    // For Transaction mode (port 6543), keep query params if present
    // For Direct connection (port 5432), strip query params
    const port = u.port || (u.protocol === 'postgresql:' || u.protocol === 'postgres:' ? '5432' : '');
    if (port === '6543' || port === '5432') {
      // Transaction mode or Session mode - keep query params
      connectionString = rawDbUrl;
    } else {
      // Direct connection - strip query params
      u.search = "";
      connectionString = u.toString();
    }
  } catch {
    console.error("Invalid database URL");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co') 
      ? { rejectUnauthorized: false } // Supabase uses certificates that may not be trusted by Node.js
      : process.env.NODE_ENV === "production" 
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Increased for Transaction mode
    allowExitOnIdle: false,
  });
  const client = await pool.connect();
  try {
    // For Transaction mode, we execute statements individually without a transaction
    // Transaction mode doesn't support all SQL features in a single transaction
    const dir = path.resolve("migrations");
    
    // Check if we're using Transaction mode (port 6543)
    const isTransactionMode = connectionString.includes(':6543/');
    
    let files: string[];
    
    // Files to exclude (fix scripts, manual scripts, drop scripts)
    const excludePatterns = [
      'fix_column_names',
      'FIX_COLUMN_NAMES',
      'drop_and_recreate',
      'DROP_AND_RECREATE'
    ];
    
    const shouldExclude = (filename: string): boolean => {
      return excludePatterns.some(pattern => filename.includes(pattern));
    };
    
    // If Transaction mode, prefer _simple.sql files (without DO blocks)
    if (isTransactionMode) {
      console.log("📋 Transaction mode detected, using simplified migration files");
      const simpleFiles = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith("_simple.sql") && !shouldExclude(f))
        .sort();
      const regularFiles = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".sql") && !f.includes("_simple") && !shouldExclude(f))
        .sort();
      
      // Use simple files if available, otherwise fall back to regular files
      files = simpleFiles.length > 0 ? simpleFiles : regularFiles;
    } else {
      // For Direct/Session mode, use regular files
      files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".sql") && !f.includes("_simple") && !shouldExclude(f))
        .sort();
    }
    
    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      
      try {
        await client.query(sql);
        console.log(`  ✅ ${file} completed`);
      } catch (err: any) {
        // Ignore "already exists" errors for idempotent migrations
        if (err.code === '42P07' || err.code === '42710' || err.message?.includes('already exists')) {
          console.log(`  ⚠️  ${file} - Some objects already exist, continuing...`);
        } else {
          console.error(`  ❌ ${file} failed:`, err.message);
          if (err.code) {
            console.error(`     Error code: ${err.code}`);
          }
          throw err;
        }
      }
    }
    console.log("✅ All migrations applied successfully.");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    if (err.code) {
      console.error(`   Error code: ${err.code}`);
    }
    if (err.position) {
      console.error(`   Position: ${err.position}`);
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
