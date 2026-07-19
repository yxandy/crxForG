const DEFAULT_API_BASE_URL = "https://mailmanage.yxandy.cc.cd";
const DEFAULT_NAS_BASE_URL = "http://10.189.111.82:8787";

const apiBaseUrlInput = document.querySelector("#apiBaseUrl");
const nasBaseUrlInput = document.querySelector("#nasBaseUrl");
const tokenInput = document.querySelector("#token");
const saveButton = document.querySelector("#saveOptions");
const statusOutput = document.querySelector("#status");

init();

async function init() {
  const saved = await chrome.storage.local.get([
    "mailmanageApiBaseUrl",
    "nasBaseUrl",
    "mailmanageToken"
  ]);

  apiBaseUrlInput.value = saved.mailmanageApiBaseUrl || DEFAULT_API_BASE_URL;
  nasBaseUrlInput.value = saved.nasBaseUrl || DEFAULT_NAS_BASE_URL;
  tokenInput.value = saved.mailmanageToken || "";
  setStatus("配置保存在当前浏览器本地。");

  saveButton.addEventListener("click", saveOptions);
}

async function saveOptions() {
  const apiBaseUrl = normalizeApiBaseUrl(apiBaseUrlInput.value);
  const nasBaseUrl = normalizeApiBaseUrl(nasBaseUrlInput.value);
  const token = tokenInput.value.trim();

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

  await chrome.storage.local.set({
    mailmanageApiBaseUrl: apiBaseUrl,
    nasBaseUrl,
    mailmanageToken: token
  });

  setStatus("配置已保存。", "success");
}

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function setStatus(message, type = "") {
  statusOutput.textContent = message;
  statusOutput.className = `status ${type}`.trim();
}
