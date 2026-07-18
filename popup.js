const DEFAULT_CONFIG = {
  waitMs: 10000,
  navigationTimeoutMs: 30000,
  delayBeforeClicksMs: 0,
  values: {
    username: "test_user",
    password: "123456"
  },
  fields: [
    {
      selector: "input[type='email']",
      value: "tester@example.com"
    }
  ],
  reads: [
    {
      name: "页面标题",
      selector: "h1",
      property: "text"
    }
  ],
  clicks: []
};

const targetUrlInput = document.querySelector("#targetUrl");
const configText = document.querySelector("#configText");
const statusOutput = document.querySelector("#status");
const startFillButton = document.querySelector("#startFill");
const fillCurrentButton = document.querySelector("#fillCurrent");
const formatConfigButton = document.querySelector("#formatConfig");

init();

async function init() {
  const saved = await chrome.storage.local.get(["targetUrl", "fillConfig"]);
  targetUrlInput.value = saved.targetUrl || "";
  configText.value = JSON.stringify(saved.fillConfig || DEFAULT_CONFIG, null, 2);
  setStatus("就绪");

  startFillButton.addEventListener("click", () => handleRun("START_FILL"));
  fillCurrentButton.addEventListener("click", () => handleRun("FILL_ACTIVE_TAB"));
  formatConfigButton.addEventListener("click", formatConfig);
}

async function handleRun(type) {
  let config;

  try {
    config = parseConfig();
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  await chrome.storage.local.set({
    targetUrl: targetUrlInput.value.trim(),
    fillConfig: config
  });

  setBusy(true);
  setStatus(type === "START_FILL" ? "正在打开页面并填充..." : "正在填充当前页...");

  try {
    const response = await chrome.runtime.sendMessage({
      type,
      payload: {
        url: targetUrlInput.value,
        config
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "执行失败。");
    }

    setStatus(buildSuccessMessage(response), "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function formatConfig() {
  try {
    const config = parseConfig();
    configText.value = JSON.stringify(config, null, 2);
    setStatus("配置已格式化。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function parseConfig() {
  try {
    const config = JSON.parse(configText.value);

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("配置必须是一个 JSON 对象。");
    }

    return config;
  } catch (error) {
    if (error.message.includes("JSON")) {
      throw error;
    }

    throw new Error(`配置 JSON 解析失败：${error.message}`);
  }
}

function buildSuccessMessage(response) {
  const filledCount = response.filled?.length || 0;
  const clickedCount = response.clicked?.length || 0;
  const failedCount = response.failed?.length || 0;
  const readCount = response.read ? Object.keys(response.read).length : 0;

  return `完成：填充 ${filledCount} 项，点击 ${clickedCount} 项，读取 ${readCount} 项，失败 ${failedCount} 项。`;
}

function setBusy(isBusy) {
  startFillButton.disabled = isBusy;
  fillCurrentButton.disabled = isBusy;
  formatConfigButton.disabled = isBusy;
}

function setStatus(message, type = "") {
  statusOutput.textContent = message;
  statusOutput.className = `status ${type}`.trim();
}
