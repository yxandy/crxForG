const DEFAULT_API_BASE_URL = "https://mailmanage.yxandy.cc.cd";
const DEFAULT_NAS_BASE_URL = "http://10.189.111.82:8787";
const DEFAULT_GROK_REDIRECT_URI = "http://127.0.0.1:56121/callback";

const apiBaseUrlInput = document.querySelector("#apiBaseUrl");
const nasBaseUrlInput = document.querySelector("#nasBaseUrl");
const tokenInput = document.querySelector("#token");
const registrationPasswordInput = document.querySelector("#registrationPassword");
const sub2apiBaseUrlInput = document.querySelector("#sub2apiBaseUrl");
const sub2apiAdminApiKeyInput = document.querySelector("#sub2apiAdminApiKey");
const sub2apiGrokRedirectUriInput = document.querySelector("#sub2apiGrokRedirectUri");
const sub2apiProxyIdInput = document.querySelector("#sub2apiProxyId");
const saveButton = document.querySelector("#saveOptions");
const statusOutput = document.querySelector("#status");

init();

async function init() {
  const saved = await chrome.storage.local.get([
    "mailmanageApiBaseUrl",
    "nasBaseUrl",
    "mailmanageToken",
    "registrationPassword",
    "sub2apiBaseUrl",
    "sub2apiAdminApiKey",
    "sub2apiGrokRedirectUri",
    "sub2apiProxyId"
  ]);

  apiBaseUrlInput.value = saved.mailmanageApiBaseUrl || DEFAULT_API_BASE_URL;
  nasBaseUrlInput.value = saved.nasBaseUrl || DEFAULT_NAS_BASE_URL;
  tokenInput.value = saved.mailmanageToken || "";
  registrationPasswordInput.value = saved.registrationPassword || "";
  sub2apiBaseUrlInput.value = saved.sub2apiBaseUrl || "";
  sub2apiAdminApiKeyInput.value = saved.sub2apiAdminApiKey || "";
  sub2apiGrokRedirectUriInput.value =
    saved.sub2apiGrokRedirectUri || DEFAULT_GROK_REDIRECT_URI;
  sub2apiProxyIdInput.value = saved.sub2apiProxyId ?? "";
  setStatus("配置保存在当前浏览器本地。");

  saveButton.addEventListener("click", saveOptions);
}

async function saveOptions() {
  const apiBaseUrl = normalizeApiBaseUrl(apiBaseUrlInput.value);
  const nasBaseUrl = normalizeApiBaseUrl(nasBaseUrlInput.value);
  const token = tokenInput.value.trim();
  const registrationPassword = registrationPasswordInput.value;
  const sub2apiBaseUrl = normalizeApiBaseUrl(sub2apiBaseUrlInput.value);
  const sub2apiAdminApiKey = sub2apiAdminApiKeyInput.value.trim();
  const sub2apiGrokRedirectUri =
    normalizeText(sub2apiGrokRedirectUriInput.value) ||
    DEFAULT_GROK_REDIRECT_URI;
  const proxyIdResult = parseOptionalInteger(sub2apiProxyIdInput.value);

  if (!apiBaseUrl) {
    setStatus("请填写 mailmanage API 地址。", "error");
    apiBaseUrlInput.focus();
    return;
  }

  if (!nasBaseUrl) {
    setStatus("请填写 NAS 验证码 API 地址。", "error");
    nasBaseUrlInput.focus();
    return;
  }

  if (!token) {
    setStatus("请填写 Bearer Token。", "error");
    tokenInput.focus();
    return;
  }

  if (!registrationPassword) {
    setStatus("请填写注册密码。", "error");
    registrationPasswordInput.focus();
    return;
  }

  if (!proxyIdResult.ok) {
    setStatus(proxyIdResult.error, "error");
    sub2apiProxyIdInput.focus();
    return;
  }

  await chrome.storage.local.set({
    mailmanageApiBaseUrl: apiBaseUrl,
    nasBaseUrl,
    mailmanageToken: token,
    registrationPassword,
    sub2apiBaseUrl,
    sub2apiAdminApiKey,
    sub2apiGrokRedirectUri,
    sub2apiProxyId: proxyIdResult.value
  });

  setStatus("配置已保存。", "success");
}

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function parseOptionalInteger(value) {
  const text = String(value || "").trim();

  if (!text) {
    return {
      ok: true,
      value: ""
    };
  }

  const numberValue = Number(text);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return {
      ok: false,
      error: "Sub2API 代理 ID 必须是非负整数。"
    };
  }

  return {
    ok: true,
    value: String(numberValue)
  };
}

function setStatus(message, type = "") {
  statusOutput.textContent = message;
  statusOutput.className = `status ${type}`.trim();
}
