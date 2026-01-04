-- 000_fix_column_names.sql - Fix column names to use camelCase with double quotes
-- This migration fixes existing tables that may have been created without proper quoting

-- Fix user table
DO $$
BEGIN
  -- Check and rename columns if they exist without quotes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'emailverified') THEN
    ALTER TABLE "user" RENAME COLUMN emailverified TO "emailVerified";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'createdat') THEN
    ALTER TABLE "user" RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'updatedat') THEN
    ALTER TABLE "user" RENAME COLUMN updatedat TO "updatedAt";
  END IF;
END $$;

-- Fix session table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'expiresat') THEN
    ALTER TABLE session RENAME COLUMN expiresat TO "expiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'createdat') THEN
    ALTER TABLE session RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'updatedat') THEN
    ALTER TABLE session RENAME COLUMN updatedat TO "updatedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'ipaddress') THEN
    ALTER TABLE session RENAME COLUMN ipaddress TO "ipAddress";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'useragent') THEN
    ALTER TABLE session RENAME COLUMN useragent TO "userAgent";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'userid') THEN
    ALTER TABLE session RENAME COLUMN userid TO "userId";
  END IF;
END $$;

-- Fix account table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accountid') THEN
    ALTER TABLE account RENAME COLUMN accountid TO "accountId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'providerid') THEN
    ALTER TABLE account RENAME COLUMN providerid TO "providerId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'userid') THEN
    ALTER TABLE account RENAME COLUMN userid TO "userId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accesstoken') THEN
    ALTER TABLE account RENAME COLUMN accesstoken TO "accessToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'refreshtoken') THEN
    ALTER TABLE account RENAME COLUMN refreshtoken TO "refreshToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'idtoken') THEN
    ALTER TABLE account RENAME COLUMN idtoken TO "idToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'accesstokenexpiresat') THEN
    ALTER TABLE account RENAME COLUMN accesstokenexpiresat TO "accessTokenExpiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'refreshtokenexpiresat') THEN
    ALTER TABLE account RENAME COLUMN refreshtokenexpiresat TO "refreshTokenExpiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'createdat') THEN
    ALTER TABLE account RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'updatedat') THEN
    ALTER TABLE account RENAME COLUMN updatedat TO "updatedAt";
  END IF;
END $$;

-- Fix verification table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'expiresat') THEN
    ALTER TABLE verification RENAME COLUMN expiresat TO "expiresAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'createdat') THEN
    ALTER TABLE verification RENAME COLUMN createdat TO "createdAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verification' AND column_name = 'updatedat') THEN
    ALTER TABLE verification RENAME COLUMN updatedat TO "updatedAt";
  END IF;
END $$;

-- Recreate indexes with correct column names
DROP INDEX IF EXISTS idx_session_userId;
CREATE INDEX IF NOT EXISTS idx_session_userId ON session("userId");

DROP INDEX IF EXISTS idx_account_userId;
CREATE INDEX IF NOT EXISTS idx_account_userId ON account("userId");




