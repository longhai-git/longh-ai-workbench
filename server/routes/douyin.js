import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// 抖音开放平台配置
// OAuth回调地址: https://longhaicm.cn/api/douyin/callback
// Webhook地址: https://longhaicm.cn/api/douyin/webhook

/**
 * 抖音Webhook验证 + 事件推送接收
 * 抖音开放平台 Webhooks 请求网址填: https://longhaicm.cn/api/douyin/webhook
 *
 * 抖音验证请求格式：
 * {"event": "verify_webhook", "client_key": "xxx", "content": {"challenge": 12345}}
 * 需要解析 content.challenge 值，返回 text 格式的 JSON: {"challenge": 12345}
 * 注意：返回Content-Type必须是text/plain，不能用application/json
 */
router.post('/webhook', (req, res) => {
  const body = req.body || {};
  console.log('[Douyin Webhook] 收到请求:', JSON.stringify(body).substring(0, 500));

  // CHALLENGE 验证：抖音验证URL有效性时发送
  // challenge可能在顶层，也可能在 content.challenge 里
  let challenge = null;
  if (body.event === 'verify_webhook' && body.content?.challenge) {
    challenge = body.content.challenge;
  } else if (body.challenge) {
    challenge = body.challenge;
  } else if (body.content?.challenge) {
    challenge = body.content.challenge;
  }

  if (challenge !== null && challenge !== undefined) {
    console.log('[Douyin Webhook] CHALLENGE验证，返回challenge:', challenge);
    // 抖音要求返回 text 格式的 JSON 数据，不能用 res.json()
    return res.type('text/plain').send(JSON.stringify({ challenge }));
  }

  // 事件推送处理
  if (body.event || body.header?.event) {
    const eventType = body.event || body.header?.event;
    console.log('[Douyin Webhook] 事件推送:', eventType);
    // 这里可以根据事件类型做不同处理
  }

  // 默认返回成功
  res.type('text/plain').send(JSON.stringify({ success: true }));
});

// GET方式的Webhook验证（部分平台用GET验证）
router.get('/webhook', (req, res) => {
  const { challenge } = req.query;
  if (challenge) {
    return res.json({ challenge });
  }
  res.json({ success: true });
});

/**
 * 抖音OAuth授权回调
 * 抖音开放平台回调地址填: https://longhaicm.cn/api/douyin/callback
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // 授权失败
  if (error) {
    return res.redirect(`/settings/platforms?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/settings/platforms?error=未获取到授权码');
  }

  try {
    // 从state中获取用户ID（发起授权时传入的）
    const userId = state;

    // 获取用户配置的抖音API凭证
    const config = db.prepare('SELECT * FROM platform_configs WHERE platform = ? AND user_id = ?')
      .get('douyin', userId);

    if (!config) {
      return res.redirect('/settings/platforms?error=未找到抖音API配置');
    }

    // 用授权码换取access_token
    const tokenRes = await fetch('https://open.douyin.com/oauth/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_key: config.client_key,
        client_secret: config.client_secret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    // 抖音API返回格式: { data: { access_token, open_id, error_code, ... }, message: "success" }
    // error_code: 0 表示成功
    const tokenInfo = tokenData.data || tokenData;
    const errorCode = tokenInfo.error_code;
    const hasError = (errorCode !== undefined && errorCode !== 0) || !tokenInfo.access_token;

    if (hasError) {
      console.error('Douyin token exchange failed:', JSON.stringify(tokenData));
      const errMsg = tokenInfo.description || tokenData.message || '未知错误';
      return res.redirect(`/settings/platforms?error=${encodeURIComponent('授权失败: ' + errMsg)}`);
    }

    const { access_token, expires_in, refresh_token, open_id } = tokenInfo;

    // 获取用户信息（抖音返回格式: { data: { nickname, ... }, message: "success" }）
    const userInfoRes = await fetch('https://open.douyin.com/oauth/userinfo/', {
      headers: {
        'access-token': access_token,
        'open-id': open_id,
      },
    });
    const userInfo = await userInfoRes.json();
    const userInfoData = userInfo.data || userInfo;

    const nickname = userInfoData.nickname || userInfoData.screen_name || '抖音用户';

    // 保存/更新授权信息到数据库
    const existing = db.prepare('SELECT id FROM platform_accounts WHERE platform = ? AND user_id = ?')
      .get('douyin', userId);

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    if (existing) {
      db.prepare(`
        UPDATE platform_accounts 
        SET access_token = ?, refresh_token = ?, open_id = ?, nickname = ?, expires_at = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(access_token, refresh_token, open_id, nickname, expiresAt, existing.id);
    } else {
      db.prepare(`
        INSERT INTO platform_accounts (id, user_id, platform, open_id, nickname, access_token, refresh_token, expires_at, status)
        VALUES (?, ?, 'douyin', ?, ?, ?, ?, ?, 'active')
      `).run(uuidv4(), userId, open_id, nickname, access_token, refresh_token, expiresAt);
    }

    // 重定向回设置页面，带成功标识
    res.redirect('/settings/platforms?success=抖音账号绑定成功');
  } catch (err) {
    console.error('Douyin OAuth callback error:', err);
    res.redirect('/settings/platforms?error=授权回调处理失败');
  }
});

/**
 * 发起抖音授权
 * 前端点击"去绑定"按钮调用此接口，返回授权URL
 */
router.post('/authorize', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // 从数据库获取抖音应用配置
  const config = db.prepare('SELECT * FROM platform_configs WHERE platform = ? AND user_id = ?')
    .get('douyin', userId);

  if (!config || !config.client_key) {
    return res.status(400).json({ error: '请先在设置中填写抖音应用的Client Key' });
  }

  const redirectUri = encodeURIComponent(`${process.env.BASE_URL || 'https://longhaicm.cn'}/api/douyin/callback`);
  const authUrl = `https://open.douyin.com/platform/oauth/connect/?client_key=${config.client_key}&response_type=code&scope=${encodeURIComponent('trial.whitelist,user_info,video.create,video.data')}&redirect_uri=${redirectUri}&state=${userId}`;

  res.json({ authUrl });
});

/**
 * 保存抖音API凭证（Client Key / Client Secret）
 */
router.post('/config', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { client_key, client_secret } = req.body;

  if (!client_key || !client_secret) {
    return res.status(400).json({ error: 'Client Key和Client Secret不能为空' });
  }

  // 创建表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_configs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      client_key TEXT,
      client_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, platform)
    )
  `);

  const existing = db.prepare('SELECT id FROM platform_configs WHERE platform = ? AND user_id = ?')
    .get('douyin', userId);

  if (existing) {
    db.prepare('UPDATE platform_configs SET client_key = ?, client_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(client_key, client_secret, existing.id);
  } else {
    db.prepare('INSERT INTO platform_configs (id, user_id, platform, client_key, client_secret) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), userId, 'douyin', client_key, client_secret);
  }

  res.json({ success: true, message: '抖音API配置已保存' });
});

/**
 * 获取抖音绑定状态
 */
router.get('/status', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // 创建表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      open_id TEXT,
      nickname TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const account = db.prepare('SELECT platform, nickname, status, expires_at FROM platform_accounts WHERE platform = ? AND user_id = ?')
    .get('douyin', userId);

  const config = db.prepare('SELECT client_key FROM platform_configs WHERE platform = ? AND user_id = ?')
    .get('douyin', userId);

  res.json({
    platform: 'douyin',
    bound: !!account,
    nickname: account?.nickname || null,
    status: account?.status || 'unbound',
    expired: account ? new Date(account.expires_at) < new Date() : false,
    hasConfig: !!config,
    callbackUrl: `${process.env.BASE_URL || 'https://longhaicm.cn'}/api/douyin/callback`,
  });
});

/**
 * 解绑抖音账号
 */
router.delete('/unbind', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.prepare('DELETE FROM platform_accounts WHERE platform = ? AND user_id = ?')
    .run('douyin', userId);
  res.json({ success: true, message: '已解绑抖音账号' });
});

export default router;
