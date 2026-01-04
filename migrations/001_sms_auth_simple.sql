-- 001_sms_auth_simple.sql - SMS authentication support (Transaction mode compatible)

-- 扩展 user 表以支持手机号登录
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 创建短信验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires ON sms_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_codes_created ON sms_codes(created_at);

-- 触发器更新 updated_at (simplified, without DO block)
DROP TRIGGER IF EXISTS trg_sms_codes_updated_at ON sms_codes;
CREATE TRIGGER trg_sms_codes_updated_at BEFORE UPDATE ON sms_codes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();




