/**
 * 阿里云短信服务配置
 * 使用 getter 函数动态读取环境变量
 */
export const smsConfig = {
  // 短信签名
  get signName() {
    return process.env.ALIYUN_SMS_SIGN_NAME || "";
  },
  
  // 短信模板代码
  get templateCode() {
    return process.env.ALIYUN_SMS_TEMPLATE_CODE || "";
  },
  
  // 阿里云访问密钥ID（支持多种环境变量名称）
  get accessKeyId() {
    return process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "";
  },
  
  // 阿里云访问密钥Secret（支持多种环境变量名称）
  get accessKeySecret() {
    return process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || "";
  },
  
  // 阿里云短信服务端点
  get endpoint() {
    return process.env.ALIYUN_SMS_ENDPOINT || "dysmsapi.aliyuncs.com";
  },
  
  // 验证码有效期（分钟）
  get codeExpirationMinutes() {
    return parseInt(process.env.SMS_CODE_EXPIRATION_MINUTES || "5");
  },
  
  // 是否启用短信发送（开发环境可以关闭）
  get enabled() {
    return process.env.SMS_ENABLED !== 'false';
  }
};




