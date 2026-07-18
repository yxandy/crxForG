const DEFAULT_NAVIGATION_TIMEOUT_MS = 30000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_FILL") {
    openAndFill(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FILL_ACTIVE_TAB") {
    fillActiveTab(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function openAndFill(payload = {}) {
  const url = normalizeUrl(payload.url);
  const config = normalizeConfig(payload.config);
  const activeTab = await getActiveTab();
  const tab = activeTab?.id
    ? await chrome.tabs.update(activeTab.id, { active: true, url })
    : await chrome.tabs.create({ active: true, url });

  await waitForTabComplete(tab.id, config.navigationTimeoutMs);
  return injectAndFill(tab.id, config);
}

async function fillActiveTab(payload = {}) {
  const config = normalizeConfig(payload.config);
  const activeTab = await getActiveTab();

  if (!activeTab?.id) {
    throw new Error("未找到当前活动标签页。");
  }

  return injectAndFill(activeTab.id, config);
}

async function injectAndFill(tabId, config) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "AUTO_FILL",
    payload: config
  });

  if (!response?.ok) {
    throw new Error(response?.error || "页面填充失败。");
  }

  return response;
}

function getActiveTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0]);
}

function normalizeUrl(input) {
  const rawUrl = String(input || "").trim();

  if (!rawUrl) {
    throw new Error("请先输入要打开的网址。");
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
}

function normalizeConfig(config = {}) {
  return {
    ...config,
    waitMs: toPositiveNumber(config.waitMs, 10000),
    navigationTimeoutMs: toPositiveNumber(
      config.navigationTimeoutMs,
      DEFAULT_NAVIGATION_TIMEOUT_MS
    ),
    delayBeforeClicksMs: toPositiveNumber(config.delayBeforeClicksMs, 0)
  };
}

function toPositiveNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      finish();
      reject(new Error("页面打开超时，请确认网址是否可访问。"));
    }, timeoutMs);

    const finish = () => {
      if (done) {
        return;
      }

      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish();
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") {
          finish();
          resolve();
        }
      })
      .catch((error) => {
        finish();
        reject(error);
      });
  });
}
