const DEFAULT_MAILMANAGE_API_BASE_URL = "https://mailmanage.yxandy.cc.cd";

self.mailmanageClient = {
  claimGEmail,
  updateGEmailStatus
};

async function claimGEmail(settings = {}) {
  const apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
  const token = normalizeToken(settings.token);
  const response = await fetch(`${apiBaseUrl}/api/internal/g-email/claim`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
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
  const response = await fetch(`${apiBaseUrl}/api/internal/g-email/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await readMailmanageJsonResponse(response);

  if (!response.ok || !result.success) {
    throw new Error(result.error || "更新 G 邮箱状态失败。");
  }

  return result;
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
