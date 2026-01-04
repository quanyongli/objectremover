#!/usr/bin/env tsx
/**
 * 数据库连接测试脚本
 * 用于测试 Supabase PostgreSQL 数据库连接和基本操作
 * 
 * 使用方法：
 *   pnpm test:db
 *   或
 *   pnpm tsx scripts/test-db.ts
 * 
 * 环境变量配置：
 *   DATABASE_URL - PostgreSQL 连接字符串（必需）
 *   USE_SOCKS_PROXY - 是否使用 SOCKS 代理（默认: false）
 *   SOCKS_PROXY_HOST - SOCKS 代理主机（默认: 127.0.0.1）
 *   SOCKS_PROXY_PORT - SOCKS 代理端口（默认: 7891，Clash 的 SOCKS 端口）
 *   CLASH_HTTP_PORT - Clash HTTP 代理端口（默认: 7890，仅用于提示）
 * 
 * 注意：PostgreSQL 使用 TCP 连接，HTTP_PROXY/HTTPS_PROXY 环境变量无效
 * 推荐解决方案：
 *   1. 在 Clash 中配置 Supabase 直连（推荐）
 *   2. 启用 Clash 的"系统代理"功能
 *   3. 使用 SOCKS 代理（需要额外配置，pg 库本身不支持）
 */

import "dotenv/config";
import { Pool } from "pg";

// 从环境变量获取数据库连接字符串
const rawDbUrl = process.env.DATABASE_URL || "";

if (!rawDbUrl) {
  console.error("❌ 错误: DATABASE_URL 环境变量未设置");
  console.log("\n请确保在 .env 文件中设置了 DATABASE_URL");
  process.exit(1);
}

// 代理配置（通过环境变量设置）
// 注意：pg 库使用 TCP 连接，HTTP_PROXY 不起作用
// 如果使用 Clash 代理，建议：
// 1. 在 Clash 中配置 Supabase 直连（推荐）
// 2. 或启用 Clash 的系统代理功能
// 3. 或使用 SOCKS 代理（需要额外配置）
const USE_SOCKS_PROXY = process.env.USE_SOCKS_PROXY === "true";
const SOCKS_PROXY_HOST = process.env.SOCKS_PROXY_HOST || "127.0.0.1";
const SOCKS_PROXY_PORT = process.env.SOCKS_PROXY_PORT || "7891"; // Clash 默认 SOCKS 端口
const CLASH_HTTP_PORT = process.env.CLASH_HTTP_PORT || "7890"; // Clash 默认 HTTP 端口

// 处理连接字符串（移除查询参数）
let connectionString = rawDbUrl;
try {
  const u = new URL(rawDbUrl);
  u.search = "";
  connectionString = u.toString();
} catch (error) {
  console.warn("⚠️  警告: 无法解析 DATABASE_URL，使用原始字符串");
}

// 显示连接信息（隐藏密码）
console.log("📋 连接配置:");
const connectionInfo = new URL(connectionString);
const hostname = connectionInfo.hostname;
const port = connectionInfo.port || '5432';
const username = connectionInfo.username || '';
const database = connectionInfo.pathname.slice(1);

console.log(`   主机: ${hostname}`);
console.log(`   端口: ${port}`);
console.log(`   数据库: ${database}`);
console.log(`   用户: ${username}`);
console.log(`   SSL: ${connectionString.includes('supabase.co') ? '启用 (Supabase)' : '根据环境配置'}`);

// 验证连接字符串格式
if (port === '6543') {
  // Transaction mode 格式检查（支持两种格式）
  if (hostname.includes('pooler.supabase.com') && username.includes('.')) {
    console.log("   ✅ Transaction mode (Pooler) 连接字符串格式正确");
  } else if (hostname.includes('db.') && hostname.includes('.supabase.co') && username === 'postgres') {
    console.log("   ✅ Transaction mode (Pooler) 连接字符串格式正确");
  } else {
    console.log("\n⚠️  警告: Transaction mode 连接字符串格式可能不正确！");
    console.log("   支持的格式:");
    console.log("   1. postgresql://postgres.xxx:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres");
    console.log("   2. postgres://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres");
    console.log("\n   获取正确连接字符串:");
    console.log("   1. 打开 Supabase Dashboard: https://supabase.com/dashboard");
    console.log("   2. 选择项目 → Settings → Database");
    console.log("   3. 点击 'Connect' 按钮");
    console.log("   4. 选择 'Transaction pooler'");
    console.log("   5. 复制连接字符串");
  }
} else if (port === '5432') {
  if (hostname.includes('pooler.supabase.com') && username.includes('.')) {
    console.log("   ✅ Session mode 连接字符串格式正确");
  } else if (hostname.includes('db.') && hostname.includes('.supabase.co') && username === 'postgres') {
    console.log("   ✅ Direct connection 格式正确（需要 IPv6 支持）");
  }
}

// 显示代理配置信息
if (USE_SOCKS_PROXY) {
  console.log(`   ⚠️  SOCKS 代理: ${SOCKS_PROXY_HOST}:${SOCKS_PROXY_PORT}`);
  console.log(`   ⚠️  注意: pg 库不支持 SOCKS 代理，此配置无效`);
} else if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  console.log(`   ⚠️  HTTP 代理已设置，但对 TCP 连接（PostgreSQL）无效`);
}
console.log();

// 提示代理配置
if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || USE_SOCKS_PROXY) {
  console.log("💡 代理提示:");
  console.log("   PostgreSQL 使用 TCP 连接，HTTP_PROXY/HTTPS_PROXY 环境变量对其无效。");
  console.log("   推荐解决方案：");
  console.log("   1. 在 Clash 中配置 Supabase 直连（最简单）");
  console.log("   2. 启用 Clash 的'系统代理'功能");
  console.log("   3. 或在 .env 中设置 USE_SOCKS_PROXY=false 以禁用代理配置");
  console.log();
}

// 创建连接池（增加超时时间）
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase.co') 
    ? { rejectUnauthorized: false }
    : process.env.NODE_ENV === "production" 
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 增加到 30 秒
  allowExitOnIdle: false,
});

// 测试函数
async function testDatabase() {
  console.log("🔍 开始测试数据库连接...\n");

  // 1. 测试基本连接
  console.log("1️⃣  测试基本连接...");
  console.log("   尝试连接到数据库（最多等待 30 秒）...");
  let client;
  try {
    // 设置超时
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("连接超时")), 30000);
    });
    
    client = await Promise.race([connectPromise, timeoutPromise]) as any;
    console.log("✅ 数据库连接成功\n");
  } catch (error: any) {
    console.error("❌ 数据库连接失败:", error.message);
    console.error("   错误代码:", error.code || "未知");
    
    // 提供诊断建议
    if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
      console.error("\n💡 诊断: DNS 解析失败");
      console.error("   可能原因:");
      console.error("   1. 网络连接问题");
      console.error("   2. 代理设置问题（如果使用 Clash 等代理）");
      console.error("   3. DNS 服务器问题");
      console.error("\n   建议:");
      console.error("   - 检查网络连接");
      console.error("   - 如果使用代理，请配置代理或让 Supabase 直连");
      console.error("   - 尝试使用其他 DNS 服务器（如 8.8.8.8）");
    } else if (error.message.includes("timeout") || error.message.includes("超时")) {
      console.error("\n💡 诊断: 连接超时");
      console.error("   可能原因:");
      console.error("   1. 防火墙阻止了连接");
      console.error("   2. Supabase 数据库未创建或未激活");
      console.error("   3. 网络不稳定");
      console.error("   4. 代理设置导致连接缓慢");
      console.error("\n   建议:");
      console.error("   - 检查 Supabase 项目是否已创建并激活");
      console.error("   - 检查防火墙设置");
      console.error("   - 如果使用代理，尝试禁用代理或配置直连");
      console.error("   - 检查 Supabase 控制台中的数据库连接信息");
    } else if (error.code === "ECONNREFUSED") {
      console.error("\n💡 诊断: 连接被拒绝");
      console.error("   可能原因:");
      console.error("   1. 数据库服务器未运行");
      console.error("   2. 端口被阻止");
      console.error("   3. 连接字符串中的主机或端口错误");
    } else if (error.code === "ETIMEDOUT") {
      console.error("\n💡 诊断: 连接超时");
      console.error("   可能原因:");
      console.error("   1. 网络延迟过高");
      console.error("   2. 代理设置问题");
      console.error("   3. Supabase 服务暂时不可用");
    }
    
    console.error("\n📝 下一步:");
    console.error("   1. 检查 Supabase 控制台: https://supabase.com/dashboard");
    console.error("   2. 确认数据库连接字符串是否正确");
    console.error("   3. 检查项目设置中的数据库状态");
    console.error("   4. 如果使用 Clash 代理:");
    console.error("      a) 在 Clash 中配置 Supabase 直连（推荐）");
    console.error("      b) 或启用 Clash 的'系统代理'功能");
    console.error("      c) 或临时关闭代理测试连接");
    console.error("   5. 注意: HTTP_PROXY 环境变量对 PostgreSQL TCP 连接无效");
    
    process.exit(1);
  }

  try {
    // 2. 测试查询数据库版本
    console.log("2️⃣  测试查询数据库版本...");
    const versionResult = await client.query("SELECT version();");
    console.log("✅ 数据库版本:", versionResult.rows[0].version.split(" ")[0] + "\n");

    // 3. 测试查询当前数据库名
    console.log("3️⃣  测试查询当前数据库...");
    const dbResult = await client.query("SELECT current_database();");
    console.log("✅ 当前数据库:", dbResult.rows[0].current_database + "\n");

    // 4. 测试查询所有表
    console.log("4️⃣  测试查询数据库表...");
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`✅ 找到 ${tablesResult.rows.length} 个表:`);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach((row: { table_name: string }, index: number) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log("   (没有找到表)");
    }
    console.log();

    // 5. 测试 user 表是否存在
    console.log("5️⃣  测试 user 表...");
    const userTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user'
      );
    `);
    const userTableExists = userTableResult.rows[0].exists;
    if (userTableExists) {
      console.log("✅ user 表存在");
      
      // 查询 user 表结构
      const userColumnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user'
        ORDER BY ordinal_position;
      `);
      console.log(`   列数: ${userColumnsResult.rows.length}`);
      userColumnsResult.rows.forEach((col: { column_name: string; data_type: string; is_nullable: string }, index: number) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });

      // 查询用户数量
      const userCountResult = await client.query('SELECT COUNT(*) as count FROM "user";');
      console.log(`   用户数量: ${userCountResult.rows[0].count}`);
    } else {
      console.log("⚠️  user 表不存在");
    }
    console.log();

    // 6. 测试 sms_codes 表是否存在
    console.log("6️⃣  测试 sms_codes 表...");
    const smsTableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sms_codes'
      );
    `);
    const smsTableExists = smsTableResult.rows[0].exists;
    if (smsTableExists) {
      console.log("✅ sms_codes 表存在");
      
      // 查询 sms_codes 表结构
      const smsColumnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sms_codes'
        ORDER BY ordinal_position;
      `);
      console.log(`   列数: ${smsColumnsResult.rows.length}`);
      smsColumnsResult.rows.forEach((col: { column_name: string; data_type: string; is_nullable: string }, index: number) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log("⚠️  sms_codes 表不存在（可能需要运行迁移）");
    }
    console.log();

    // 7. 测试写入操作（插入测试数据到临时表）
    console.log("7️⃣  测试写入操作...");
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS _test_connection (
          id SERIAL PRIMARY KEY,
          test_message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await client.query(`
        INSERT INTO _test_connection (test_message) 
        VALUES ('Database connection test at ' || NOW()::TEXT);
      `);
      const testReadResult = await client.query('SELECT * FROM _test_connection ORDER BY id DESC LIMIT 1;');
      console.log("✅ 写入和读取测试成功");
      console.log(`   测试记录: ${testReadResult.rows[0].test_message}`);
      
      // 清理测试表
      await client.query('DROP TABLE IF EXISTS _test_connection;');
      console.log("✅ 已清理测试表");
    } catch (error: any) {
      console.error("❌ 写入测试失败:", error.message);
    }
    console.log();

    // 8. 显示连接池统计信息
    console.log("8️⃣  连接池统计:");
    console.log(`   总连接数: ${pool.totalCount}`);
    console.log(`   空闲连接数: ${pool.idleCount}`);
    console.log(`   等待连接数: ${pool.waitingCount}`);
    console.log();

    console.log("🎉 所有测试完成！数据库连接正常。\n");

  } catch (error: any) {
    console.error("❌ 测试过程中出错:", error.message);
    console.error("   错误代码:", error.code);
    if (error.stack) {
      console.error("\n堆栈跟踪:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // 释放连接
    if (client) {
      client.release();
    }
    // 关闭连接池
    await pool.end();
    console.log("✅ 已关闭数据库连接");
  }
}

// 运行测试
testDatabase().catch((error) => {
  console.error("❌ 未处理的错误:", error);
  process.exit(1);
});

