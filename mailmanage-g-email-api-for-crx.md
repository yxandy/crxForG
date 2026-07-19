# mailmanage G 邮箱领取与状态回写接口对接说明

## 背景

Chrome 扩展在自动注册流程中需要使用一个 iCloud 隐藏邮箱。

邮箱池由 `mailmanage` 项目统一管理，Chrome 扩展不要自己保存或筛选邮箱池。扩展只通过 `mailmanage` 的内部 API 领取邮箱，并在注册成功后回写状态。

## 鉴权方式

所有接口都使用 Bearer Token。

请求头固定带：

```http
Authorization: Bearer <TOKEN>
```

`<TOKEN>` 使用 `mailmanage` 项目中配置的：

```text
HME_INGEST_TOKEN
```

如果服务端使用的是兼容旧配置，也可能是：

```text
EXECUTOR_TOKEN
```

扩展端不要把 token 写死在公开仓库里。开发阶段可放在本地配置、扩展选项页，或构建时注入的私有配置中。

## 基础地址

生产环境：

```text
https://mailmanage.yxandy.cc.cd
```

如有测试环境，替换为测试域名。

## 接口 1：领取一个未注册 G 邮箱

### URL

```http
POST /api/internal/g-email/claim
```

完整地址示例：

```text
https://mailmanage.yxandy.cc.cd/api/internal/g-email/claim
```

### 请求示例

```js
async function claimGEmail() {
  const response = await fetch("https://mailmanage.yxandy.cc.cd/api/internal/g-email/claim", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAILMANAGE_TOKEN}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "领取 G 邮箱失败");
  }

  return result;
}
```

### 成功返回

```json
{
  "success": true,
  "email": "xxx@icloud.com",
  "emailAccountId": "uuid",
  "claimedAt": "2026-07-19T10:00:00.000Z",
  "registered": false
}
```

### 字段说明

- `email`：本次领取到的邮箱地址。
- `emailAccountId`：`mailmanage` 内部邮箱记录 ID。
- `claimedAt`：领取时间。
- `registered`：固定为 `false`，表示领取不等于注册成功。

### 重要语义

调用这个接口只表示“预占/取走一个邮箱”。

它不会把邮箱标记为“已注册 G”。

只有当 Chrome 扩展真的完成注册流程后，才可以调用状态回写接口。

### 没有可用邮箱时

可能返回：

```json
{
  "success": false,
  "email": null,
  "error": "当前没有可领取的未注册 G 邮箱"
}
```

此时扩展应该停止本轮注册流程，并展示明确错误，不要无限重试。

## 接口 2：注册成功后回写 G 状态

### URL

```http
POST /api/internal/g-email/status
```

完整地址示例：

```text
https://mailmanage.yxandy.cc.cd/api/internal/g-email/status
```

### 使用场景

当扩展使用领取到的邮箱完成 G 注册后，调用该接口更新状态。

如果同时完成了 s2a 关联，也一并回写。

### 请求示例

```js
async function updateGEmailStatus(email) {
  const response = await fetch("https://mailmanage.yxandy.cc.cd/api/internal/g-email/status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MAILMANAGE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      isRegisteredG: true,
      gRegisteredAt: new Date().toISOString(),
      isLinkedS2A: true,
      linkedAt: new Date().toISOString(),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "更新 G 邮箱状态失败");
  }

  return result;
}
```

### 请求体字段

```json
{
  "email": "xxx@icloud.com",
  "isRegisteredG": true,
  "gRegisteredAt": "2026-07-19T10:00:00+08:00",
  "isLinkedS2A": true,
  "linkedAt": "2026-07-19T10:05:00+08:00"
}
```

字段说明：

- `email`：必填，领取到的邮箱地址。
- `isRegisteredG`：可选，是否已注册 G。
- `gRegisteredAt`：可选，G 注册时间。
- `isLinkedS2A`：可选，是否已关联 s2a。
- `linkedAt`：可选，s2a 关联时间。

如果 `isRegisteredG = true` 但没有传 `gRegisteredAt`，服务端会自动使用当前时间。

如果 `isLinkedS2A = true` 但没有传 `linkedAt`，服务端会自动使用当前时间。

至少需要传 `isRegisteredG` 或 `isLinkedS2A` 其中一个。

### 兼容 snake_case

接口也支持 snake_case：

```json
{
  "email": "xxx@icloud.com",
  "is_registered_g": true,
  "g_registered_at": "2026-07-19T10:00:00+08:00",
  "is_linked_s2a": true,
  "linked_at": "2026-07-19T10:05:00+08:00"
}
```

### 成功返回

```json
{
  "success": true,
  "email": "xxx@icloud.com",
  "emailAccountId": "uuid",
  "g": {
    "isRegistered": true,
    "registeredAt": "2026-07-19T02:00:00.000Z",
    "isLinkedS2A": true,
    "linkedAt": "2026-07-19T02:05:00.000Z"
  }
}
```

## 推荐流程

1. 扩展开始注册流程。
2. 调用 `/api/internal/g-email/claim` 领取邮箱。
3. 使用返回的 `email` 填入注册页面。
4. 如果注册失败：
   - 暂时不要调用 `/api/internal/g-email/status`。
   - 当前版本没有释放邮箱接口，失败记录由后续人工或新接口处理。
5. 如果注册成功：
   - 调用 `/api/internal/g-email/status`
   - 传 `isRegisteredG: true`
6. 如果后续 s2a 关联成功：
   - 再调用 `/api/internal/g-email/status`
   - 传 `isLinkedS2A: true`

## 开发建议

实现时请封装一个 `mailmanageClient`，不要把 `fetch` 散落在业务流程里。至少提供两个函数：

```text
claimGEmail()
updateGEmailStatus()
```

## 注意事项

1. 不要把“领取成功”当成“注册成功”。
2. 不要重复调用领取接口来拿多个邮箱，除非当前注册流程确实需要新的邮箱。
3. 不要在失败时随便把 `isRegisteredG` 写成 `true`。
4. 如果状态回写失败，扩展应该保留当前邮箱和错误信息，方便用户重试回写。
5. Token 不要提交到 git。
6. 如果 Chrome 扩展直接从浏览器请求该接口，需要确认服务端 CORS 已允许。当前 `mailmanage` 接口支持 CORS。
