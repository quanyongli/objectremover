/**
 * 阿里云图形验证码服务端二次校验
 * 用于 Vercel Serverless Functions
 */

// 阿里云二次校验参数类型
interface AliCaptchaResult {
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

/**
 * 阿里云验证码二次校验
 * @param captchaResult - 前端传来的验证结果
 * @returns 校验是否通过
 */
export async function validateCaptcha(captchaResult: any): Promise<boolean> {
  // 动态读取环境变量
  const appId = process.env.ALICAPTCHA_APP_ID || process.env.PUBLIC_ALIYUN_CAPTCHA_ID;
  const appKey = process.env.ALICAPTCHA_APP_KEY;

  if (!appId || !appKey) {
    console.error('阿里云验证码 appId/appKey 未配置，无法进行图形验证码二次校验');
    // 在开发环境中，如果没有配置key，可以临时返回true以便流程测试
    if (process.env.NODE_ENV !== 'production') {
      console.warn('开发模式：图形验证码二次校验被跳过');
      return true;
    }
    return false;
  }

  const { lot_number, captcha_output, pass_token, gen_time } = captchaResult as AliCaptchaResult;

  if (!lot_number || !captcha_output || !pass_token || !gen_time) {
    console.error('验证码参数不完整');
    return false;
  }

  // 生成 sign_token，HMAC-SHA256(lot_number, appKey)
  const cryptoModule = await import('crypto');
  const sign_token = cryptoModule.createHmac('sha256', appKey)
    .update(lot_number)
    .digest('hex');

  const url = `https://captcha.alicaptcha.com/validate?captcha_id=${appId}`;
  const params = new URLSearchParams({
    lot_number,
    captcha_output,
    pass_token,
    gen_time,
    sign_token,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (data && data.result === 'success') {
      console.log('图形验证码二次校验成功');
      return true;
    } else {
      console.error('图形验证码二次校验失败:', data);
      return false;
    }
  } catch (error: any) {
    console.error('请求阿里云验证码二次校验接口时出错:', error.message);
    return false;
  }
}

