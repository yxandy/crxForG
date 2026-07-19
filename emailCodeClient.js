const DEFAULT_NAS_BASE_URL = "http://10.189.111.82:8787";

self.emailCodeClient = {
  getLatestEmailCode
};

async function getLatestEmailCode(settings = {}, payload = {}) {
  const nasBaseUrl = normalizeNasBaseUrl(settings.nasBaseUrl);
  const token = normalizeEmailCodeToken(settings.token);
  const recipient = String(payload.recipient || "").trim();

  if (!recipient) {
    throw new Error("缺少验证码收件人邮箱。");
  }

  const url = new URL("/api/internal/email-codes/latest", nasBaseUrl);
  url.searchParams.set("recipient", recipient);

  if (payload.consume) {
    url.searchParams.set("consume", "1");
  }

  let response;

  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: String(error)
    };
  }

  const body = await readEmailCodeJsonResponse(response);

  if (response.ok && body.ok && body.code) {
    return body;
  }

  return {
    ok: false,
    reason: body.error || "request_failed",
    status: response.status,
    message: body.message || "请求验证码接口失败。"
  };
}

function normalizeNasBaseUrl(value) {
  const nasBaseUrl = String(value || DEFAULT_NAS_BASE_URL).trim();

  return nasBaseUrl.replace(/\/+$/, "");
}

function normalizeEmailCodeToken(value) {
  const token = String(value || "").trim();

  if (!token) {
    throw new Error("请先在扩展选项页配置 Bearer Token。");
  }

  return token;
}

async function readEmailCodeJsonResponse(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {
      ok: false,
      error: "invalid_json",
      message: "接口返回不是有效 JSON。"
    };
  }
}
