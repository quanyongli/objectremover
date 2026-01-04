/**
 * 阿里云短信服务
 * 适配 Vercel Serverless Functions
 * 使用 @alicloud/pop-core（轻量级，适合 serverless 环境）
 */

import { smsConfig } from "./sms.config";

export class SmsService {
  /**
   * 发送短信验证码
   * @param phoneNumber 手机号
   * @param code 验证码
   * @returns Promise<boolean> 发送是否成功
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    // 检查是否启用短信服务
    if (!smsConfig.enabled) {
      console.log(`[开发模式] 短信服务已禁用，模拟发送成功: ${phoneNumber} - ${code}`);
      return true;
    }

    // 检查必要的配置
    if (!smsConfig.accessKeyId || !smsConfig.accessKeySecret) {
      console.error('阿里云访问密钥未配置，请在环境变量中设置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET');
      return false;
    }

    if (!smsConfig.signName || !smsConfig.templateCode) {
      console.error('短信签名或模板代码未配置');
      return false;
    }

    try {
      // 动态导入 @alicloud/pop-core
      const Core = await import("@alicloud/pop-core").catch(() => null);
      
      if (!Core) {
        console.error('@alicloud/pop-core 未安装，请运行: pnpm add @alicloud/pop-core');
        // 开发环境模拟成功
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[开发模式] 模拟发送短信验证码: ${phoneNumber} - ${code}`);
          return true;
        }
        return false;
      }

      const client = new Core.default({
        accessKeyId: smsConfig.accessKeyId,
        accessKeySecret: smsConfig.accessKeySecret,
        endpoint: `https://${smsConfig.endpoint}`,
        apiVersion: '2017-05-25'
      });

      const params = {
        PhoneNumbers: phoneNumber,
        SignName: smsConfig.signName,
        TemplateCode: smsConfig.templateCode,
        TemplateParam: JSON.stringify({ code }),
      };

      const requestOption = {
        method: 'POST'
      };

      const response = await client.request('SendSms', params, requestOption);

      // 检查发送结果
      if (response.Code === 'OK') {
        console.log(`短信验证码发送成功: ${phoneNumber} - ${code}`);
        return true;
      } else {
        console.error('短信发送失败:', response);
        return false;
      }
    } catch (error: any) {
      console.error('短信发送异常:', error);
      // 打印错误信息
      if (error.message) {
        console.log('错误信息:', error.message);
      }
      if (error.data && error.data["Recommend"]) {
        console.log('诊断地址:', error.data["Recommend"]);
      }
      return false;
    }
  }

  /**
   * 检查短信服务配置是否有效
   */
  isConfigured(): boolean {
    return !!(smsConfig.accessKeyId && smsConfig.accessKeySecret && smsConfig.signName && smsConfig.templateCode);
  }

  /**
   * 获取配置信息（用于调试）
   */
  getConfig() {
    return {
      signName: smsConfig.signName,
      templateCode: smsConfig.templateCode,
      endpoint: smsConfig.endpoint,
      enabled: smsConfig.enabled,
      hasCredentials: this.isConfigured()
    };
  }
}

// 导出单例实例
export const smsService = new SmsService();




