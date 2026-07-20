const targetUrlInput = document.querySelector("#targetUrl");
const delayMinInput = document.querySelector("#delayMinMs");
const delayMaxInput = document.querySelector("#delayMaxMs");
const statusOutput = document.querySelector("#status");
const openUrlButton = document.querySelector("#openUrl");
const startGrokSub2ApiAuthButton = document.querySelector("#startGrokSub2ApiAuth");
const completeGrokSub2ApiImportButton = document.querySelector("#completeGrokSub2ApiImport");
const grokAuthCodeInput = document.querySelector("#grokAuthCode");
const openOptionsButton = document.querySelector("#openOptions");
let statusLines = [];

init();

async function init() {
  const saved = await chrome.storage.local.get([
    "targetUrl",
    "delayMinMs",
    "delayMaxMs"
  ]);

  targetUrlInput.value = saved.targetUrl || "";
  delayMinInput.value = saved.delayMinMs ?? "200";
  delayMaxInput.value = saved.delayMaxMs ?? "400";
  setStatus("请输入目标网址。");

  openUrlButton.addEventListener("click", openTargetUrl);
  startGrokSub2ApiAuthButton.addEventListener("click", startGrokSub2ApiAuth);
  completeGrokSub2ApiImportButton.addEventListener("click", completeGrokSub2ApiImport);
  openOptionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  targetUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openTargetUrl();
    }
  });
}

async function openTargetUrl() {
  const targetUrl = targetUrlInput.value.trim();
  const delayRange = getDelayRange();

  if (!targetUrl) {
    setStatus("请先输入目标网址。", "error");
    targetUrlInput.focus();
    return;
  }

  if (!delayRange.ok) {
    setStatus(delayRange.error, "error");
    delayRange.target.focus();
    return;
  }

  await chrome.storage.local.set({
    targetUrl,
    delayMinMs: delayRange.minMs,
    delayMaxMs: delayRange.maxMs
  });

  setBusy(true);
  setStatus("正在打开目标网址...");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "OPEN_URL",
      payload: {
        url: targetUrl
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "目标网址打开失败。");
    }

    setStepStatus(["第一步：网址打开成功"], "success");
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const stepTwoResponse = await chrome.runtime.sendMessage({
      type: "RUN_EMAIL_REGISTER_STEP",
      payload: {
        tabId: response.tabId,
        waitMs: 10000
      }
    });

    if (!stepTwoResponse?.ok) {
      throw new Error(stepTwoResponse?.error || "第二步执行失败。");
    }

    setStepStatus(["第一步：网址打开成功", "第二步，准备邮箱注册"], "success");
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const claimResponse = await chrome.runtime.sendMessage({
      type: "CLAIM_G_EMAIL"
    });

    if (!claimResponse?.ok) {
      throw new Error(claimResponse?.error || "第三步执行失败。");
    }

    setStepStatus(
      ["第一步：网址打开成功", "第二步，准备邮箱注册", "第三步：领取邮箱成功"],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const fillEmailResponse = await chrome.runtime.sendMessage({
      type: "FILL_CLAIMED_EMAIL",
      payload: {
        tabId: response.tabId,
        email: claimResponse.email,
        waitMs: 10000
      }
    });

    if (!fillEmailResponse?.ok) {
      throw new Error(fillEmailResponse?.error || "第四步执行失败。");
    }

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功"
      ],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const registerResponse = await chrome.runtime.sendMessage({
      type: "RUN_REGISTER_SUBMIT_STEP",
      payload: {
        tabId: response.tabId,
        waitMs: 10000
      }
    });

    if (!registerResponse?.ok) {
      throw new Error(registerResponse?.error || "第五步执行失败。");
    }

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功",
        "第五步：注册按钮已点击"
      ],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const codeResponse = await waitForEmailCode(claimResponse.email);

    if (!codeResponse.ok) {
      throw new Error(codeResponse.message || "第六步执行失败。");
    }

    await chrome.storage.local.set({
      currentEmailCode: {
        code: codeResponse.code,
        recipient: codeResponse.recipient,
        subject: codeResponse.subject,
        sender: codeResponse.sender,
        emailDate: codeResponse.emailDate,
        expiresAt: codeResponse.expiresAt
      }
    });

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功",
        "第五步：注册按钮已点击",
        "第六步：获取邮箱验证码成功"
      ],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const fillCodeResponse = await chrome.runtime.sendMessage({
      type: "FILL_EMAIL_CODE",
      payload: {
        tabId: response.tabId,
        code: codeResponse.code,
        waitMs: 10000
      }
    });

    if (!fillCodeResponse?.ok) {
      throw new Error(fillCodeResponse?.error || "第七步执行失败。");
    }

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功",
        "第五步：注册按钮已点击",
        "第六步：获取邮箱验证码成功",
        "第七步：验证码填入成功"
      ],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const markRegisteredResponse = await chrome.runtime.sendMessage({
      type: "MARK_G_EMAIL_REGISTERED",
      payload: {
        email: claimResponse.email
      }
    });

    if (!markRegisteredResponse?.ok) {
      throw createStepError(
        markRegisteredResponse?.error || "第八步执行失败。",
        markRegisteredResponse?.debug
      );
    }

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功",
        "第五步：注册按钮已点击",
        "第六步：获取邮箱验证码成功",
        "第七步：验证码填入成功",
        "第八步：注册成功状态已回写"
      ],
      "success"
    );
    await waitRandomDelay(delayRange.minMs, delayRange.maxMs);

    const profileResponse = await chrome.runtime.sendMessage({
      type: "FILL_USER_PROFILE",
      payload: {
        tabId: response.tabId,
        waitMs: 10000
      }
    });

    if (!profileResponse?.ok) {
      throw new Error(profileResponse?.error || "第九步执行失败。");
    }

    setStepStatus(
      [
        "第一步：网址打开成功",
        "第二步，准备邮箱注册",
        "第三步：领取邮箱成功",
        "第四步：邮箱填入成功",
        "第五步：注册按钮已点击",
        "第六步：获取邮箱验证码成功",
        "第七步：验证码填入成功",
        "第八步：注册成功状态已回写",
        "第九步：用户姓名和密码已填入"
      ],
      "success"
    );
  } catch (error) {
    if (statusLines.length > 0) {
      setStepStatus([...statusLines, buildErrorStatusText(error)], "error");
    } else {
      setStatus(buildErrorStatusText(error), "error");
    }
  } finally {
    setBusy(false);
  }
}

async function startGrokSub2ApiAuth() {
  setBusy(true);
  setStepStatus([
    "Grok 导入：正在生成授权链接...",
    "Grok 导入：稍后会自动点击 Allow 并读取授权码"
  ]);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "START_GROK_SUB2API_AUTH"
    });

    if (!response?.ok) {
      throw createStepError(
        response?.error || "Grok 授权链接生成失败。",
        response?.debug
      );
    }

    const account = response.account || {};
    const linkedEmailLine = response.linkedEmailError
      ? `s2a 状态回写失败：${response.linkedEmailError}`
      : `s2a 状态回写邮箱：${response.linkedEmail || "未返回"}`;
    setStepStatus(
      [
        "Grok 导入：已自动点击 Allow",
        "Grok 导入：已自动读取授权码",
        "Grok 导入：Sub2API 账号创建成功",
        `账号 ID：${account.id ?? "未返回"}`,
        `账号名称：${account.name || "未返回"}`,
        `账号状态：${account.status || "未返回"}`,
        linkedEmailLine
      ],
      response.linkedEmailError ? "error" : "success"
    );
  } catch (error) {
    setStepStatus(
      [
        buildErrorStatusText(error),
        "可以再次点击“导入 Grok 到 Sub2API”重新生成授权页。",
        "如果已看到授权码，也可以粘贴后点击“完成 Grok 导入”。"
      ],
      "error"
    );
  } finally {
    setBusy(false);
  }
}

async function completeGrokSub2ApiImport() {
  const code = grokAuthCodeInput.value.trim();

  if (!code) {
    setStatus("请先粘贴 Grok 授权码。", "error");
    grokAuthCodeInput.focus();
    return;
  }

  setBusy(true);
  setStepStatus(["Grok 导入：正在创建 Sub2API 账号..."]);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "COMPLETE_GROK_SUB2API_IMPORT",
      payload: {
        code
      }
    });

    if (!response?.ok) {
      throw createStepError(
        response?.error || "创建 Sub2API Grok 账号失败。",
        response?.debug
      );
    }

    const account = response.account || {};
    const linkedEmailLine = response.linkedEmailError
      ? `s2a 状态回写失败：${response.linkedEmailError}`
      : `s2a 状态回写邮箱：${response.linkedEmail || "未返回"}`;
    setStepStatus(
      [
        "Grok 导入：Sub2API 账号创建成功",
        `账号 ID：${account.id ?? "未返回"}`,
        `账号名称：${account.name || "未返回"}`,
        `账号状态：${account.status || "未返回"}`,
        linkedEmailLine
      ],
      response.linkedEmailError ? "error" : "success"
    );
  } catch (error) {
    setStatus(buildErrorStatusText(error), "error");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  openUrlButton.disabled = isBusy;
  startGrokSub2ApiAuthButton.disabled = isBusy;
  completeGrokSub2ApiImportButton.disabled = isBusy;
  openOptionsButton.disabled = isBusy;
  delayMinInput.disabled = isBusy;
  delayMaxInput.disabled = isBusy;
  targetUrlInput.disabled = isBusy;
  grokAuthCodeInput.disabled = isBusy;
}

function setStatus(message, type = "") {
  statusLines = [];
  statusOutput.textContent = message;
  statusOutput.className = `status ${type}`.trim();
}

function setStepStatus(lines, type = "") {
  statusLines = lines;
  statusOutput.textContent = statusLines.join("\n");
  statusOutput.className = `status ${type}`.trim();
}

function getDelayRange() {
  const minMs = Number(delayMinInput.value);
  const maxMs = Number(delayMaxInput.value);

  if (!Number.isInteger(minMs) || minMs < 0) {
    return {
      ok: false,
      error: "最小延迟必须是非负整数。",
      target: delayMinInput
    };
  }

  if (!Number.isInteger(maxMs) || maxMs < 0) {
    return {
      ok: false,
      error: "最大延迟必须是非负整数。",
      target: delayMaxInput
    };
  }

  if (minMs > maxMs) {
    return {
      ok: false,
      error: "最小延迟不能大于最大延迟。",
      target: delayMinInput
    };
  }

  return {
    ok: true,
    minMs,
    maxMs
  };
}

function waitRandomDelay(minMs, maxMs) {
  const delayMs = getRandomInteger(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getRandomInteger(minValue, maxValue) {
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function createStepError(message, debug) {
  const error = new Error(message);
  error.debug = debug || null;
  return error;
}

function buildErrorStatusText(error) {
  const lines = [`执行失败：${error.message}`];

  if (error.debug) {
    lines.push(`调试：${formatDebugInfo(error.debug)}`);
  }

  return lines.join("\n");
}

function formatDebugInfo(debug) {
  return [
    debug.action ? `动作=${debug.action}` : "",
    debug.method ? `方法=${debug.method}` : "",
    debug.url ? `地址=${debug.url}` : "",
    debug.redirectUri ? `回调=${debug.redirectUri}` : "",
    debug.proxyId !== undefined && debug.proxyId !== null
      ? `代理ID=${debug.proxyId}`
      : "",
    debug.email ? `邮箱=${debug.email}` : "",
    debug.status ? `状态=${debug.status}` : "",
    debug.responseCode !== undefined && debug.responseCode !== null
      ? `业务码=${debug.responseCode}`
      : "",
    debug.responseMessage ? `响应=${debug.responseMessage}` : "",
    debug.errorName ? `错误类型=${debug.errorName}` : "",
    debug.errorMessage ? `错误信息=${debug.errorMessage}` : "",
    debug.failedAt ? `失败时间=${debug.failedAt}` : ""
  ]
    .filter(Boolean)
    .join("；");
}

async function waitForEmailCode(recipient) {
  const timeoutMs = 120000;
  const intervalMs = 5000;
  const startedAt = Date.now();

  setStepStatus([...statusLines, "第六步：等待邮箱验证码..."], "success");

  while (Date.now() - startedAt < timeoutMs) {
    const response = await chrome.runtime.sendMessage({
      type: "GET_EMAIL_CODE",
      payload: {
        recipient,
        consume: false
      }
    });

    if (response?.ok && response.code) {
      return response;
    }

    if (response?.reason && response.reason !== "email_code_not_found") {
      return {
        ok: false,
        message: response.message || "获取邮箱验证码失败。"
      };
    }

    await sleep(intervalMs);
  }

  return {
    ok: false,
    message: "等待邮箱验证码超时。"
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
