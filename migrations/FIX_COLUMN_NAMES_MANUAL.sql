-- =====================================================
-- 手动修复列名脚本 - 在 Supabase Dashboard SQL Editor 中运行
-- =====================================================
-- 此脚本修复 verification 表和其他表的列名问题
-- 将小写列名（如 expiresat）重命名为驼峰命名（如 "expiresAt"）
-- 
-- 使用方法：
-- 1. 登录 Supabase Dashboard
-- 2. 进入项目 → SQL Editor
-- 3. 复制此脚本并执行
-- =====================================================

-- 修复 verification 表
DO $$
BEGIN
  -- 检查并重命名 expiresat -> expiresAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'verification' 
    AND column_name = 'expiresat'
  ) THEN
    ALTER TABLE verification RENAME COLUMN expiresat TO "expiresAt";
    RAISE NOTICE 'Renamed verification.expiresat to verification."expiresAt"';
  END IF;
  
  -- 检查并重命名 createdat -> createdAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'verification' 
    AND column_name = 'createdat'
  ) THEN
    ALTER TABLE verification RENAME COLUMN createdat TO "createdAt";
    RAISE NOTICE 'Renamed verification.createdat to verification."createdAt"';
  END IF;
  
  -- 检查并重命名 updatedat -> updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'verification' 
    AND column_name = 'updatedat'
  ) THEN
    ALTER TABLE verification RENAME COLUMN updatedat TO "updatedAt";
    RAISE NOTICE 'Renamed verification.updatedat to verification."updatedAt"';
  END IF;
END $$;

-- 修复 session 表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'expiresat') THEN
    ALTER TABLE session RENAME COLUMN expiresat TO "expiresAt";
    RAISE NOTICE 'Renamed session.expiresat to session."expiresAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'createdat') THEN
    ALTER TABLE session RENAME COLUMN createdat TO "createdAt";
    RAISE NOTICE 'Renamed session.createdat to session."createdAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'updatedat') THEN
    ALTER TABLE session RENAME COLUMN updatedat TO "updatedAt";
    RAISE NOTICE 'Renamed session.updatedat to session."updatedAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'ipaddress') THEN
    ALTER TABLE session RENAME COLUMN ipaddress TO "ipAddress";
    RAISE NOTICE 'Renamed session.ipaddress to session."ipAddress"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'useragent') THEN
    ALTER TABLE session RENAME COLUMN useragent TO "userAgent";
    RAISE NOTICE 'Renamed session.useragent to session."userAgent"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'userid') THEN
    ALTER TABLE session RENAME COLUMN userid TO "userId";
    RAISE NOTICE 'Renamed session.userid to session."userId"';
  END IF;
END $$;

-- 修复 account 表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'accountid') THEN
    ALTER TABLE account RENAME COLUMN accountid TO "accountId";
    RAISE NOTICE 'Renamed account.accountid to account."accountId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'providerid') THEN
    ALTER TABLE account RENAME COLUMN providerid TO "providerId";
    RAISE NOTICE 'Renamed account.providerid to account."providerId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'userid') THEN
    ALTER TABLE account RENAME COLUMN userid TO "userId";
    RAISE NOTICE 'Renamed account.userid to account."userId"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'accesstoken') THEN
    ALTER TABLE account RENAME COLUMN accesstoken TO "accessToken";
    RAISE NOTICE 'Renamed account.accesstoken to account."accessToken"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'refreshtoken') THEN
    ALTER TABLE account RENAME COLUMN refreshtoken TO "refreshToken";
    RAISE NOTICE 'Renamed account.refreshtoken to account."refreshToken"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'idtoken') THEN
    ALTER TABLE account RENAME COLUMN idtoken TO "idToken";
    RAISE NOTICE 'Renamed account.idtoken to account."idToken"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'accesstokenexpiresat') THEN
    ALTER TABLE account RENAME COLUMN accesstokenexpiresat TO "accessTokenExpiresAt";
    RAISE NOTICE 'Renamed account.accesstokenexpiresat to account."accessTokenExpiresAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'refreshtokenexpiresat') THEN
    ALTER TABLE account RENAME COLUMN refreshtokenexpiresat TO "refreshTokenExpiresAt";
    RAISE NOTICE 'Renamed account.refreshtokenexpiresat to account."refreshTokenExpiresAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'createdat') THEN
    ALTER TABLE account RENAME COLUMN createdat TO "createdAt";
    RAISE NOTICE 'Renamed account.createdat to account."createdAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'updatedat') THEN
    ALTER TABLE account RENAME COLUMN updatedat TO "updatedAt";
    RAISE NOTICE 'Renamed account.updatedat to account."updatedAt"';
  END IF;
END $$;

-- 修复 user 表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'emailverified') THEN
    ALTER TABLE "user" RENAME COLUMN emailverified TO "emailVerified";
    RAISE NOTICE 'Renamed user.emailverified to user."emailVerified"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'createdat') THEN
    ALTER TABLE "user" RENAME COLUMN createdat TO "createdAt";
    RAISE NOTICE 'Renamed user.createdat to user."createdAt"';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'updatedat') THEN
    ALTER TABLE "user" RENAME COLUMN updatedat TO "updatedAt";
    RAISE NOTICE 'Renamed user.updatedat to user."updatedAt"';
  END IF;
END $$;

-- 重新创建索引（使用正确的列名）
DROP INDEX IF EXISTS idx_session_userId;
CREATE INDEX IF NOT EXISTS idx_session_userId ON session("userId");

DROP INDEX IF EXISTS idx_account_userId;
CREATE INDEX IF NOT EXISTS idx_account_userId ON account("userId");

-- 验证修复结果
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('verification', 'session', 'account', 'user')
  AND column_name LIKE '%At' OR column_name LIKE '%Id' OR column_name LIKE '%Token'
ORDER BY table_name, column_name;




