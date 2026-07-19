const targetUrlInput = document.querySelector("#targetUrl");
const delayMinInput = document.querySelector("#delayMinMs");
const delayMaxInput = document.querySelector("#delayMaxMs");
const statusOutput = document.querySelector("#status");
const openUrlButton = document.querySelector("#openUrl");
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
  } catch (error) {
    if (statusLines.length > 0) {
      setStepStatus([...statusLines, `执行失败：${error.message}`], "error");
    } else {
      setStatus(error.message, "error");
    }
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  openUrlButton.disabled = isBusy;
  openOptionsButton.disabled = isBusy;
  delayMinInput.disabled = isBusy;
  delayMaxInput.disabled = isBusy;
  targetUrlInput.disabled = isBusy;
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
