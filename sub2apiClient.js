const DEFAULT_GROK_REDIRECT_URI = "http://127.0.0.1:56121/callback";

self.sub2apiClient = {
  createGrokAuthSession,
  createSub2ApiGrokAccount
};

async function createGrokAuthSession(settings = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const adminApiKey = normalizeAdminApiKey(settings.adminApiKey);
  const redirectUri = normalizeRedirectUri(settings.redirectUri);
  const proxyId = normalizeOptionalInteger(settings.proxyId);
  const url = `${apiBaseUrl}/api/v1/admin/grok/oauth/auth-url`;
  const body = {
    redirect_uri: redirectUri
  };

  if (proxyId !== null) {
    body.proxy_id = proxyId;
  }

  const debug = {
    action: "生成 Grok OAuth 授权 URL",
    url,
    method: "POST",
    redirectUri,
    proxyId,
    startedAt: new Date().toISOString()
  };
  const response = await fetchSub2Api(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": adminApiKey
    },
    body: JSON.stringify(body)
  }, "生成 Grok OAuth 授权 URL", debug);
  debug.status = response.status;
  debug.statusText = response.statusText;
  const result = await readSub2ApiJsonResponse(response);
  debug.responseCode = result.code ?? null;
  debug.responseMessage = result.message || null;

  if (!response.ok || result.code !== 0) {
    throw withDebug(result.message || "生成 Grok OAuth 授权 URL 失败。", debug);
  }

  if (!result.data?.auth_url) {
    throw withDebug("Sub2API 没有返回 Grok 授权 URL。", debug);
  }

  if (!result.data?.session_id) {
    throw withDebug("Sub2API 没有返回 Grok 授权会话 ID。", debug);
  }

  return {
    authUrl: result.data.auth_url,
    sessionId: result.data.session_id,
    state: result.data.state || "",
    redirectUri,
    proxyId
  };
}

async function createSub2ApiGrokAccount(settings = {}, input = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const adminApiKey = normalizeAdminApiKey(settings.adminApiKey);
  const redirectUri = normalizeRedirectUri(input.redirectUri || settings.redirectUri);
  const proxyId = normalizeOptionalInteger(input.proxyId ?? settings.proxyId);
  const sessionId = normalizeRequiredText(input.sessionId, "缺少 Grok 授权会话 ID，请先生成授权链接。");
  const code = normalizeRequiredText(input.code, "请先粘贴 Grok 授权码。");
  const state = String(input.state || "").trim();
  const url = `${apiBaseUrl}/api/v1/admin/grok/oauth/create-from-oauth`;
  const body = {
    session_id: sessionId,
    code,
    redirect_uri: redirectUri,
    concurrency: 1,
    priority: 50
  };

  if (state) {
    body.state = state;
  }

  if (proxyId !== null) {
    body.proxy_id = proxyId;
  }

  const debug = {
    action: "创建 Sub2API Grok OAuth 账号",
    url,
    method: "POST",
    redirectUri,
    proxyId,
    codeLength: code.length,
    startedAt: new Date().toISOString()
  };
  const response = await fetchSub2Api(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": adminApiKey
    },
    body: JSON.stringify(body)
  }, "创建 Sub2API Grok OAuth 账号", debug);
  debug.status = response.status;
  debug.statusText = response.statusText;
  const result = await readSub2ApiJsonResponse(response);
  debug.responseCode = result.code ?? null;
  debug.responseMessage = result.message || null;

  if (!response.ok || result.code !== 0) {
    throw withDebug(result.message || "创建 Sub2API Grok OAuth 账号失败。", debug);
  }

  if (!result.data) {
    throw withDebug("Sub2API 没有返回账号信息。", debug);
  }

  return result.data;
}

async function fetchSub2Api(url, options, actionName, debug = null) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const nextDebug = debug
      ? {
          ...debug,
          errorName: error.name,
          errorMessage: error.message,
          failedAt: new Date().toISOString()
        }
      : null;

    throw withDebug(
      `${actionName}网络请求失败，请检查 Sub2API 地址、服务状态或 CORS/预检配置：${error.message}`,
      nextDebug
    );
  }
}

function normalizeApiBaseUrl(value) {
  const apiBaseUrl = String(value || "").trim().replace(/\/+$/, "");

  if (!apiBaseUrl) {
    throw new Error("请先在扩展选项页配置 Sub2API 地址。");
  }

  return apiBaseUrl;
}

function normalizeAdminApiKey(value) {
  const adminApiKey = String(value || "").trim();

  if (!adminApiKey) {
    throw new Error("请先在扩展选项页配置 Sub2API Admin API Key。");
  }

  return adminApiKey;
}

function normalizeRedirectUri(value) {
  return String(value || DEFAULT_GROK_REDIRECT_URI).trim();
}

function normalizeRequiredText(value, message) {
  const text = String(value || "").trim();

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function normalizeOptionalInteger(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const numberValue = Number(text);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error("Sub2API 代理 ID 必须是非负整数。");
  }

  return numberValue;
}

function withDebug(message, debug) {
  const error = new Error(message);
  error.debug = debug;
  return error;
}

async function readSub2ApiJsonResponse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {
      code: -1,
      message: "接口返回不是有效 JSON。"
    };
  }
}
