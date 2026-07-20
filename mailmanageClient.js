const DEFAULT_MAILMANAGE_API_BASE_URL = "https://mailmanage.yxandy.cc.cd";

self.mailmanageClient = {
  claimGEmail,
  updateGEmailStatus
};

async function claimGEmail(settings = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const token = normalizeToken(settings.token);
  const url = `${apiBaseUrl}/api/internal/g-email/claim`;
  const response = await fetchMailmanage(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  }, "领取 G 邮箱");
  const result = await readMailmanageJsonResponse(response);

  if (!response.ok || !result.success) {
    throw new Error(result.error || "领取 G 邮箱失败。");
  }

  if (!result.email) {
    throw new Error("接口没有返回可用邮箱。");
  }

  return result;
}

async function updateGEmailStatus(settings = {}, payload = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const token = normalizeToken(settings.token);
  const url = `${apiBaseUrl}/api/internal/g-email/status`;
  const debug = {
    action: "更新 G 邮箱状态",
    url,
    method: "POST",
    email: payload.email || null,
    requestBodyKeys: Object.keys(payload || {}),
    startedAt: new Date().toISOString()
  };
  const response = await fetchMailmanage(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }, "更新 G 邮箱状态", debug);
  debug.status = response.status;
  debug.statusText = response.statusText;
  const result = await readMailmanageJsonResponse(response);
  debug.responseSuccess = result.success === true;
  debug.responseError = result.error || null;

  if (!response.ok || !result.success) {
    throw withDebug(result.error || "更新 G 邮箱状态失败。", debug);
  }

  return {
    ...result,
    debug
  };
}

async function fetchMailmanage(url, options, actionName, debug = null) {
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
      `${actionName}网络请求失败，请检查 mailmanage API 地址、服务状态或 CORS/预检配置：${error.message}`,
      nextDebug
    );
  }
}

function withDebug(message, debug) {
  const error = new Error(message);
  error.debug = debug;
  return error;
}

function normalizeApiBaseUrl(value) {
  const apiBaseUrl = String(value || DEFAULT_MAILMANAGE_API_BASE_URL).trim();

  return apiBaseUrl.replace(/\/+$/, "");
}

function normalizeToken(value) {
  const token = String(value || "").trim();

  if (!token) {
    throw new Error("请先在扩展选项页配置 mailmanage Token。");
  }

  return token;
}

async function readMailmanageJsonResponse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {
      success: false,
      error: "接口返回不是有效 JSON。"
    };
  }
}
