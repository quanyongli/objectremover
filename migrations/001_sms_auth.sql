-- 001_sms_auth.sql - SMS authentication support

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

-- 创建唯一约束（每个手机号只保留最新的验证码记录）
-- 注意：如果需要保留历史记录，可以去掉这个约束
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_codes_phone_unique ON sms_codes(phone_number) WHERE used = false;

-- 触发器更新 updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_sms_codes_updated_at') THEN
    CREATE TRIGGER trg_sms_codes_updated_at BEFORE UPDATE ON sms_codes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;




