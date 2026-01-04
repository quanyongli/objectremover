-- 000_fix_column_names_simple.sql - Fix column names (Transaction mode compatible)
-- This migration fixes existing tables that may have been created without proper quoting
-- Note: PostgreSQL doesn't support IF EXISTS for RENAME COLUMN, so we'll handle errors gracefully
-- This file should be run manually or with error handling in the migration script

-- Fix user table (only if columns exist in lowercase)
-- Note: These will fail silently if columns don't exist or are already renamed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'emailverified' AND table_schema = 'public') THEN
    ALTER TABLE "user" RENAME COLUMN emailverified TO "emailVerified";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'createdat' AND table_schema = 'public') THEN
    ALTER TABLE "user" RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'updatedat' AND table_schema = 'public') THEN
    ALTER TABLE "user" RENAME COLUMN updatedat TO "updatedAt";
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if columns don't exist or are already renamed
  NULL;
END $$;

-- Fix session table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'expiresat' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN expiresat TO "expiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'createdat' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'updatedat' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN updatedat TO "updatedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'ipaddress' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN ipaddress TO "ipAddress";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'useragent' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN useragent TO "userAgent";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'userid' AND table_schema = 'public') THEN
    ALTER TABLE session RENAME COLUMN userid TO "userId";
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Fix account table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accountid' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN accountid TO "accountId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'providerid' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN providerid TO "providerId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'userid' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN userid TO "userId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accesstoken' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN accesstoken TO "accessToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'refreshtoken' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN refreshtoken TO "refreshToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'idtoken' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN idtoken TO "idToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accesstokenexpiresat' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN accesstokenexpiresat TO "accessTokenExpiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'refreshtokenexpiresat' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN refreshtokenexpiresat TO "refreshTokenExpiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'createdat' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'updatedat' AND table_schema = 'public') THEN
    ALTER TABLE account RENAME COLUMN updatedat TO "updatedAt";
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Fix verification table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'expiresat' AND table_schema = 'public') THEN
    ALTER TABLE verification RENAME COLUMN expiresat TO "expiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'createdat' AND table_schema = 'public') THEN
    ALTER TABLE verification RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'updatedat' AND table_schema = 'public') THEN
    ALTER TABLE verification RENAME COLUMN updatedat TO "updatedAt";
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recreate indexes with correct column names
DROP INDEX IF EXISTS idx_session_userId;
CREATE INDEX IF NOT EXISTS idx_session_userId ON session("userId");

DROP INDEX IF EXISTS idx_account_userId;
CREATE INDEX IF NOT EXISTS idx_account_userId ON account("userId");

