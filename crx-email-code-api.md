# Chrome 扩展接入 NAS 验证码查询接口说明

本文档用于指导 Chrome MV3 扩展项目接入 NAS 上的 `wecom-notifier` 服务，从 126 主邮箱同步出的验证码记录中，按原始收件人邮箱查询最新可用验证码。

## 1. 使用场景

示例流程：

1. Chrome 扩展在网页上使用 `a@icloud.com` 注册某个网站。
2. 网站把验证码邮件发送到 `a@icloud.com`。
3. `a@icloud.com` 自动转发到 126 主邮箱。
4. NAS 服务通过 IMAP 轮询 126 主邮箱，识别验证码并按原始收件人保存。
5. Chrome 扩展调用 NAS 内部接口，使用 `recipient=a@icloud.com` 查询验证码。
6. 扩展拿到验证码后填入网页验证码输入框。

NAS 服务不需要知道具体网站，也不处理注册业务，只负责保存和查询短期可用验证码。

## 2. 接口地址

局域网内调用地址：

```text
http://10.189.111.82:8787/api/internal/email-codes/latest
```

完整示例：

```text
http://10.189.111.82:8787/api/internal/email-codes/latest?recipient=a@icloud.com
```

如果要在返回验证码后立即标记为已使用：

```text
http://10.189.111.82:8787/api/internal/email-codes/latest?recipient=a@icloud.com&consume=1
```

## 3. 鉴权方式

接口使用 Bearer Token 鉴权。

请求头：

```http
Authorization: Bearer <EMAIL_CODE_API_TOKEN>
```

NAS 服务端需要在 `/opt/wecom-notifier/.env` 中配置：

```env
EMAIL_CODE_API_TOKEN=你的BearerToken
```

修改 `.env` 后需要重启服务：

```bash
cd /opt/wecom-notifier
sudo systemctl restart wecom-notifier
sudo systemctl status wecom-notifier --no-pager
```

可以和其他内部服务共用同一个 Bearer Token，但这意味着拿到该 Token 的项目同时拥有对应服务的访问权限。更稳妥的做法是为验证码查询接口单独生成一个长随机 Token。

## 4. 请求参数

| 参数 | 必填 | 示例 | 说明 |
|---|---|---|---|
| `recipient` | 是 | `a@icloud.com` | 原始收件人邮箱。服务端会转为小写查询。 |
| `consume` | 否 | `1` | 设置为 `1` 或 `true` 时，查询成功后会把验证码标记为已使用。 |

建议：

- 自动等待验证码阶段使用 `consume=false` 或不传 `consume`。
- 确认要填入并提交表单时，再使用 `consume=1`。
- 如果担心网页填入失败，首版可以一直不消费，等流程稳定后再开启消费。

## 5. 成功响应

HTTP 状态码：`200`

```json
{
  "ok": true,
  "code": "QH9-N6C",
  "recipient": "a@icloud.com",
  "subject": "QH9-N6C confirmation code",
  "sender": "Example <noreply@example.com>",
  "emailDate": "2026-07-19T02:00:00.000Z",
  "expiresAt": "2026-07-19T02:10:00.000Z",
  "consumed": false,
  "usedAt": null
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `ok` | 是否成功。成功时为 `true`。 |
| `code` | 识别出的验证码，可能是纯数字，也可能是字母数字或带连字符格式。 |
| `recipient` | 命中的原始收件人邮箱。 |
| `subject` | 邮件主题。 |
| `sender` | 邮件发件人。 |
| `emailDate` | 邮件发送时间。 |
| `expiresAt` | 验证码在 NAS 服务中的有效期。当前规则为邮件时间加 10 分钟。 |
| `consumed` | 本次请求是否执行了消费标记。 |
| `usedAt` | 被消费的时间。未消费时为 `null`。 |

## 6. 错误响应

### 6.1 Token 未配置

HTTP 状态码：`503`

```json
{
  "ok": false,
  "error": "email_code_api_token_not_configured",
  "message": "EMAIL_CODE_API_TOKEN 未配置。"
}
```

处理方式：检查 NAS 的 `/opt/wecom-notifier/.env` 是否配置 `EMAIL_CODE_API_TOKEN`，然后重启服务。

### 6.2 Token 错误

HTTP 状态码：`401`

```json
{
  "ok": false,
  "error": "unauthorized",
  "message": "Authorization Bearer Token 不正确。"
}
```

处理方式：检查扩展保存的 Token 是否和 NAS `.env` 中的 `EMAIL_CODE_API_TOKEN` 完全一致。

### 6.3 缺少 recipient

HTTP 状态码：`400`

```json
{
  "ok": false,
  "error": "recipient_required",
  "message": "recipient 参数不能为空。"
}
```

### 6.4 recipient 格式错误

HTTP 状态码：`400`

```json
{
  "ok": false,
  "error": "recipient_invalid",
  "message": "recipient 邮箱格式不正确。"
}
```

### 6.5 没有可用验证码

HTTP 状态码：`404`

```json
{
  "ok": false,
  "error": "email_code_not_found",
  "message": "没有可用验证码。"
}
```

这通常表示：

- 邮件还没到。
- 邮件到了但还没被 NAS 轮询扫描到。
- 邮件里没有识别出验证码。
- 验证码已经过期。
- 验证码已经被 `consume=1` 查询消费过。
- 查询的 `recipient` 和邮件中的原始收件人不一致。

## 7. Chrome MV3 接入建议

推荐结构：

```text
网页 / content script
  -> chrome.runtime.sendMessage
Chrome 扩展 background service worker
  -> fetch NAS API，并带 Bearer Token
NAS wecom-notifier
  -> 返回验证码
```

不要在网页的 page context 中保存或直接暴露 Bearer Token。Token 应保存在 `chrome.storage.local`，由 background service worker 统一请求 NAS API。

## 8. manifest.json 示例

```json
{
  "manifest_version": 3,
  "name": "验证码助手",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": [
    "http://10.189.111.82:8787/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["content.js"]
    }
  ]
}
```

`matches` 需要按实际要自动填写验证码的网站调整。

## 9. background.js 示例

```js
async function getLatestEmailCode({ recipient, consume = false }) {
  const { nasBaseUrl, emailCodeApiToken } = await chrome.storage.local.get([
    "nasBaseUrl",
    "emailCodeApiToken"
  ]);

  if (!nasBaseUrl || !emailCodeApiToken) {
    return {
      ok: false,
      reason: "config_missing",
      message: "NAS 地址或 Bearer Token 未配置。"
    };
  }

  const url = new URL("/api/internal/email-codes/latest", nasBaseUrl);
  url.searchParams.set("recipient", recipient);
  if (consume) {
    url.searchParams.set("consume", "1");
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${emailCodeApiToken}`
      }
    });
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: String(error)
    };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok) {
    return body;
  }

  return {
    ok: false,
    reason: body?.error || "request_failed",
    status: response.status,
    message: body?.message || "请求验证码接口失败。"
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GET_EMAIL_CODE") {
    return false;
  }

  getLatestEmailCode(message.payload)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        reason: "unexpected_error",
        message: String(error)
      });
    });

  return true;
});
```

## 10. content.js 示例

```js
async function queryEmailCode(recipient, { consume = false } = {}) {
  return await chrome.runtime.sendMessage({
    type: "GET_EMAIL_CODE",
    payload: {
      recipient,
      consume
    }
  });
}

async function waitForEmailCode(recipient, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const intervalMs = options.intervalMs ?? 5000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await queryEmailCode(recipient, { consume: false });

    if (result.ok && result.code) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return {
    ok: false,
    reason: "timeout",
    message: "等待验证码超时。"
  };
}

async function fillVerificationCode(recipient) {
  const found = await waitForEmailCode(recipient);
  if (!found.ok) {
    console.warn(found.message || found.reason);
    return;
  }

  const input = document.querySelector("input[name='code']");
  if (!input) {
    console.warn("未找到验证码输入框。");
    return;
  }

  input.value = found.code;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  await queryEmailCode(recipient, { consume: true });
}
```

实际项目里需要根据目标网站 DOM 调整验证码输入框选择器。

## 11. 扩展本地配置建议

扩展可以提供一个配置页面，保存：

```js
await chrome.storage.local.set({
  nasBaseUrl: "http://10.189.111.82:8787",
  emailCodeApiToken: "你的BearerToken"
});
```

读取：

```js
const { nasBaseUrl, emailCodeApiToken } = await chrome.storage.local.get([
  "nasBaseUrl",
  "emailCodeApiToken"
]);
```

## 12. 调试命令

在 NAS 本机测试：

```bash
curl -i "http://127.0.0.1:8787/api/internal/email-codes/latest?recipient=a@icloud.com" \
  -H "Authorization: Bearer 你的BearerToken"
```

在局域网其他机器测试：

```bash
curl -i "http://10.189.111.82:8787/api/internal/email-codes/latest?recipient=a@icloud.com" \
  -H "Authorization: Bearer 你的BearerToken"
```

消费验证码测试：

```bash
curl -i "http://10.189.111.82:8787/api/internal/email-codes/latest?recipient=a@icloud.com&consume=1" \
  -H "Authorization: Bearer 你的BearerToken"
```

## 13. 注意事项

- 验证码有效期当前按邮件时间加 10 分钟计算。
- 已过期验证码不会通过 API 返回。
- 已消费验证码不会再次返回。
- 服务只保存验证码、收件人、主题、发件人和时间等必要字段，不保存完整邮件正文。
- 如果同一个收件人短时间收到多封验证码邮件，接口返回最新可用记录。
- CRX 项目需要能访问 `http://10.189.111.82:8787`，如果用户不在局域网内，需要额外处理网络访问方式。
- 如果浏览器页面是 `https` 网站，扩展 background 仍然可以请求局域网 `http` 地址，但需要在 `host_permissions` 中明确授权。

## 14. 给大模型开发者的简短任务描述

可以把下面这段直接交给负责 CRX 项目的大模型：

```text
我要在 Chrome MV3 扩展中接入 NAS 验证码查询服务。

NAS API：
GET http://10.189.111.82:8787/api/internal/email-codes/latest?recipient=<邮箱>
Header: Authorization: Bearer <EMAIL_CODE_API_TOKEN>

可选参数：
consume=1 表示返回验证码后标记为已使用。

要求：
1. 不要在网页 page context 暴露 EMAIL_CODE_API_TOKEN。
2. token 和 NAS base URL 存在 chrome.storage.local。
3. 由 background service worker 负责请求 NAS API。
4. content script 通过 chrome.runtime.sendMessage 向 background 请求验证码。
5. manifest.json 添加 host_permissions: "http://10.189.111.82:8787/*"。
6. 处理 200、400、401、404、503 和网络失败。
7. 默认轮询等待时不消费，确认填入或提交前再使用 consume=1。
```
