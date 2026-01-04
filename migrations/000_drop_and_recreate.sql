-- 000_drop_and_recreate.sql - Drop and recreate tables with correct column names
-- Use this if you have no data and want to fix column naming issues
-- WARNING: This will delete all data in these tables!

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Drop function if exists
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- Now run 000_init_simple.sql to recreate tables with correct column names




