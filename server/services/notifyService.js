import crypto from 'crypto';
import nodemailer from 'nodemailer';

// ==========================================================================
// 通知服务：阿里云短信 + SMTP 邮件
// 通过环境变量配置，未配置时由调用方降级为页面显示验证码
// ==========================================================================

// ---------- 阿里云短信 ----------
function getSmsConfig() {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return null;
  }

  return {
    accessKeyId,
    accessKeySecret,
    signName,
    templateCode,
    regionId: process.env.ALIYUN_SMS_REGION_ID || 'cn-hangzhou',
  };
}

export function isSmsConfigured() {
  return getSmsConfig() !== null;
}

// 阿里云 RPC 签名要求的 percentEncode
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

export async function sendSmsCode(phone, code) {
  const config = getSmsConfig();
  if (!config) {
    return { sent: false, reason: 'NOT_CONFIGURED' };
  }

  const params = {
    AccessKeyId: config.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: config.regionId,
    SignName: config.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: config.templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(String(params[key]))}`)
    .join('&');

  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalQuery)}`;
  const signature = crypto
    .createHmac('sha1', `${config.accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');

  const url = `https://dysmsapi.aliyuncs.com/?${canonicalQuery}&Signature=${percentEncode(signature)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const data = await res.json();

    if (data.Code !== 'OK') {
      console.error('[SMS] 发送失败:', data.Code, data.Message);
      return { sent: false, reason: data.Code || 'SMS_ERROR', message: data.Message };
    }

    return { sent: true };
  } catch (err) {
    console.error('[SMS] 请求异常:', err.message);
    return { sent: false, reason: 'NETWORK_ERROR', message: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- SMTP 邮件 ----------
function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    user,
    pass,
    from: process.env.SMTP_FROM || user,
  };
}

export function isEmailConfigured() {
  return getSmtpConfig() !== null;
}

export async function sendEmailCode(email, code) {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, reason: 'NOT_CONFIGURED' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: '【LongH AI】密码重置验证码',
      text: `你的密码重置验证码是：${code}\n\n验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。`,
      html: `<p>你的密码重置验证码是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p><p>验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。</p>`,
    });

    return { sent: true };
  } catch (err) {
    console.error('[Email] 发送失败:', err.message);
    return { sent: false, reason: 'SMTP_ERROR', message: err.message };
  }
}

// 按联系方式类型分发
export async function sendResetCode({ type, contact, code }) {
  if (type === 'email') {
    return sendEmailCode(contact, code);
  }
  return sendSmsCode(contact, code);
}
