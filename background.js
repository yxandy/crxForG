importScripts("mailmanageClient.js");
importScripts("emailCodeClient.js");
importScripts("userProfileData.js");

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30000;

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
});
chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
});
configureSidePanel();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_URL") {
    openUrl(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "RUN_EMAIL_REGISTER_STEP") {
    runEmailRegisterStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CLAIM_G_EMAIL") {
    claimGEmailStep()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FILL_CLAIMED_EMAIL") {
    fillClaimedEmailStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "RUN_REGISTER_SUBMIT_STEP") {
    runRegisterSubmitStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_EMAIL_CODE") {
    getEmailCodeStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "FILL_EMAIL_CODE") {
    fillEmailCodeStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "MARK_G_EMAIL_REGISTERED") {
    markGEmailRegisteredStep(message.payload)
      .then((result) => sendResponse(result))
      .catch(async (error) => {
        const debug = error.debug || null;

        if (debug) {
          await chrome.storage.local.set({
            lastMailmanageStatusDebug: debug
          });
        }

        sendResponse({
          ok: false,
          error: error.message,
          debug
        });
      });
    return true;
  }

  if (message?.type === "FILL_USER_PROFILE") {
    fillUserProfileStep(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

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

async function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  try {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  } catch (error) {
    console.warn("侧边栏初始化失败：", error);
  }
}

async function openUrl(payload = {}) {
  const url = normalizeUrl(payload.url);
  const timeoutMs = toPositiveNumber(
    payload.navigationTimeoutMs,
    DEFAULT_NAVIGATION_TIMEOUT_MS
  );
  const activeTab = await getActiveTab();
  const tab = activeTab?.id
    ? await chrome.tabs.update(activeTab.id, { active: true, url })
    : await chrome.tabs.create({ active: true, url });

  await waitForTabComplete(tab.id, timeoutMs);

  return {
    ok: true,
    tabId: tab.id,
    url
  };
}

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

async function runEmailRegisterStep(payload = {}) {
  const tabId = payload.tabId ?? (await getActiveTab())?.id;

  if (!tabId) {
    throw new Error("未找到可执行第二步的标签页。");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "CLICK_EMAIL_REGISTER",
    payload: {
      waitMs: toPositiveNumber(payload.waitMs, 10000)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "第二步执行失败。");
  }

  return response;
}

async function claimGEmailStep() {
  const settings = await getMailmanageSettings();
  const result = await mailmanageClient.claimGEmail(settings);

  await chrome.storage.local.set({
    currentGEmailClaim: {
      email: result.email,
      emailAccountId: result.emailAccountId,
      claimedAt: result.claimedAt
    }
  });

  return {
    ok: true,
    email: result.email,
    emailAccountId: result.emailAccountId,
    claimedAt: result.claimedAt
  };
}

async function fillClaimedEmailStep(payload = {}) {
  const tabId = payload.tabId ?? (await getActiveTab())?.id;
  const email = String(payload.email || "").trim();

  if (!tabId) {
    throw new Error("未找到可执行第四步的标签页。");
  }

  if (!email) {
    throw new Error("缺少要填入的邮箱。");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "FILL_EMAIL_FIELD",
    payload: {
      email,
      waitMs: toPositiveNumber(payload.waitMs, 10000)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "第四步执行失败。");
  }

  return response;
}

async function runRegisterSubmitStep(payload = {}) {
  const tabId = payload.tabId ?? (await getActiveTab())?.id;

  if (!tabId) {
    throw new Error("未找到可执行第五步的标签页。");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "CLICK_REGISTER_SUBMIT",
    payload: {
      waitMs: toPositiveNumber(payload.waitMs, 10000)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "第五步执行失败。");
  }

  return response;
}

async function getEmailCodeStep(payload = {}) {
  const settings = await getEmailCodeSettings();

  return emailCodeClient.getLatestEmailCode(settings, {
    recipient: payload.recipient,
    consume: Boolean(payload.consume)
  });
}

async function fillEmailCodeStep(payload = {}) {
  const tabId = payload.tabId ?? (await getActiveTab())?.id;
  const code = String(payload.code || "").trim();

  if (!tabId) {
    throw new Error("未找到可执行第七步的标签页。");
  }

  if (!code) {
    throw new Error("缺少要填入的验证码。");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "FILL_EMAIL_CODE",
    payload: {
      code,
      waitMs: toPositiveNumber(payload.waitMs, 10000)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "第七步执行失败。");
  }

  return response;
}

async function markGEmailRegisteredStep(payload = {}) {
  const email = String(payload.email || "").trim();

  if (!email) {
    throw new Error("缺少要回写注册状态的邮箱。");
  }

  const settings = await getMailmanageSettings();
  const result = await mailmanageClient.updateGEmailStatus(settings, {
    email,
    isRegisteredG: true
  });
  const debug = result.debug || null;

  await chrome.storage.local.set({
    currentGEmailStatus: {
      email: result.email,
      emailAccountId: result.emailAccountId,
      isRegisteredG: result.g?.isRegistered === true,
      gRegisteredAt: result.g?.registeredAt || null
    },
    lastMailmanageStatusDebug: debug
  });

  return {
    ok: true,
    email: result.email,
    emailAccountId: result.emailAccountId,
    g: result.g,
    debug
  };
}

async function fillUserProfileStep(payload = {}) {
  const tabId = payload.tabId ?? (await getActiveTab())?.id;

  if (!tabId) {
    throw new Error("未找到可执行第九步的标签页。");
  }

  const profile = await buildUserProfile();

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "FILL_USER_PROFILE",
    payload: {
      ...profile,
      waitMs: toPositiveNumber(payload.waitMs, 10000)
    }
  });

  if (!response?.ok) {
    throw new Error(response?.error || "第九步执行失败。");
  }

  await chrome.storage.local.set({
    currentUserProfile: {
      givenName: profile.givenName,
      familyName: profile.familyName
    }
  });

  return {
    ok: true,
    givenName: profile.givenName,
    familyName: profile.familyName
  };
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

async function getMailmanageSettings() {
  const saved = await chrome.storage.local.get([
    "mailmanageApiBaseUrl",
    "mailmanageToken"
  ]);

  return {
    apiBaseUrl: saved.mailmanageApiBaseUrl,
    token: saved.mailmanageToken
  };
}

async function getEmailCodeSettings() {
  const saved = await chrome.storage.local.get([
    "nasBaseUrl",
    "mailmanageToken"
  ]);

  return {
    nasBaseUrl: saved.nasBaseUrl,
    token: saved.mailmanageToken
  };
}

async function buildUserProfile() {
  const saved = await chrome.storage.local.get(["registrationPassword"]);
  const password = String(saved.registrationPassword || "").trim();

  if (!password) {
    throw new Error("请先在扩展选项页配置注册密码。");
  }

  return {
    givenName: pickRandomItem(self.userProfileData.givenNames),
    familyName: pickRandomItem(self.userProfileData.familyNames),
    password
  };
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
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
