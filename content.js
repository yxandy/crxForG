(() => {
  if (window.__internalAutoFillerLoaded) {
    return;
  }

  window.__internalAutoFillerLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTO_FILL") {
      runAutoFill(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "CLICK_EMAIL_REGISTER") {
      clickEmailRegisterButton(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "FILL_EMAIL_FIELD") {
      fillEmailField(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "CLICK_REGISTER_SUBMIT") {
      clickRegisterSubmitButton(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "FILL_EMAIL_CODE") {
      fillEmailCodeField(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    if (message?.type === "FILL_USER_PROFILE") {
      fillUserProfileFields(message.payload)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    }

    return false;
  });
})();

async function fillUserProfileFields(rawConfig = {}) {
  const waitMs = toPositiveNumber(rawConfig.waitMs, 10000);
  const givenName = String(rawConfig.givenName || "").trim();
  const familyName = String(rawConfig.familyName || "").trim();
  const password = String(rawConfig.password || "");

  if (!givenName) {
    throw new Error("缺少要填入的名字。");
  }

  if (!familyName) {
    throw new Error("缺少要填入的姓氏。");
  }

  if (!password) {
    throw new Error("缺少要填入的密码。");
  }

  const givenNameInput = await waitForProfileInput("givenName", waitMs);
  const familyNameInput = await waitForProfileInput("familyName", waitMs);
  const passwordInput = await waitForProfileInput("password", waitMs);

  setNativeValue(givenNameInput, givenName);
  dispatchInputEvents(givenNameInput);
  setNativeValue(familyNameInput, familyName);
  dispatchInputEvents(familyNameInput);
  setNativeValue(passwordInput, password);
  dispatchInputEvents(passwordInput);

  return {
    filled: true,
    givenName,
    familyName,
    fields: {
      givenName: describeProfileInput(givenNameInput),
      familyName: describeProfileInput(familyNameInput),
      password: describeProfileInput(passwordInput)
    }
  };
}

async function fillEmailCodeField(rawConfig = {}) {
  const waitMs = toPositiveNumber(rawConfig.waitMs, 10000);
  const code = String(rawConfig.code || "").trim();

  if (!code) {
    throw new Error("缺少要填入的验证码。");
  }

  const input = await waitForEmailCodeInput(waitMs);
  input.focus();
  setNativeValue(input, code);
  dispatchOtpEvents(input, code);

  return {
    filled: true,
    selector: describeEmailCodeInput(input)
  };
}

async function clickRegisterSubmitButton(rawConfig = {}) {
  const waitMs = toPositiveNumber(rawConfig.waitMs, 10000);
  const button = await waitForRegisterSubmitButton(waitMs);

  button.click();

  return {
    clicked: true,
    matchedText: normalizeText(button.textContent)
  };
}

async function fillEmailField(rawConfig = {}) {
  const waitMs = toPositiveNumber(rawConfig.waitMs, 10000);
  const email = String(rawConfig.email || "").trim();

  if (!email) {
    throw new Error("缺少要填入的邮箱。");
  }

  const input = await waitForEmailInput(waitMs);
  setNativeValue(input, email);
  dispatchInputEvents(input);

  return {
    filled: true,
    selector: describeEmailInput(input)
  };
}

async function clickEmailRegisterButton(rawConfig = {}) {
  const waitMs = toPositiveNumber(rawConfig.waitMs, 10000);
  const button = await waitForEmailRegisterButton(waitMs);

  button.click();

  return {
    clicked: true,
    matchedText: normalizeText(button.textContent)
  };
}

function waitForProfileInput(fieldName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const findInput = () => {
      const selectorGroups = {
        givenName: [
          "input[data-testid='givenName']",
          "input[autocomplete='given-name']",
          "input[name='givenName']"
        ],
        familyName: [
          "input[data-testid='familyName']",
          "input[autocomplete='family-name']",
          "input[name='familyName']"
        ],
        password: [
          "input[data-testid='password']",
          "input[type='password'][name='password']",
          "input[name='password']",
          "input[type='password']"
        ]
      };

      for (const selector of selectorGroups[fieldName]) {
        const element = document.querySelector(selector);

        if (element) {
          return element;
        }
      }

      return Array.from(document.querySelectorAll("input")).find((element) =>
        isProfileInputByLabel(element, fieldName)
      );
    };

    const firstMatch = findInput();

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const input = findInput();

      if (input) {
        cleanup();
        resolve(input);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`等待${getProfileFieldLabel(fieldName)}输入框超时。`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function isProfileInputByLabel(element, fieldName) {
  const semanticText = [
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.id ? document.querySelector(`label[for="${escapeCssString(element.id)}"]`)?.textContent : "",
    element.closest("label")?.textContent
  ]
    .map(normalizeText)
    .join("");
  const lowerText = normalizeEnglishText(semanticText);

  if (fieldName === "givenName") {
    return semanticText.includes("名字") || lowerText.includes("firstname") || lowerText.includes("givenname");
  }

  if (fieldName === "familyName") {
    return semanticText.includes("姓氏") || lowerText.includes("lastname") || lowerText.includes("familyname");
  }

  return semanticText.includes("密码") || lowerText.includes("password");
}

function getProfileFieldLabel(fieldName) {
  if (fieldName === "givenName") {
    return "名字";
  }

  if (fieldName === "familyName") {
    return "姓氏";
  }

  return "密码";
}

function describeProfileInput(element) {
  if (element.getAttribute("data-testid")) {
    return `input[data-testid="${element.getAttribute("data-testid")}"]`;
  }

  if (element.getAttribute("autocomplete")) {
    return `input[autocomplete="${element.getAttribute("autocomplete")}"]`;
  }

  if (element.name) {
    return `input[name="${element.name}"]`;
  }

  return "input";
}

function waitForEmailCodeInput(timeoutMs) {
  return new Promise((resolve, reject) => {
    const findInput = () => {
      const semanticSelectors = [
        "input[data-input-otp='true']",
        "input[autocomplete='one-time-code']",
        "input[name='code'][maxlength='6']",
        "input[name='code']",
        "input[inputmode='numeric'][maxlength='6']",
        "input[inputmode='text'][maxlength='6']"
      ];

      for (const selector of semanticSelectors) {
        const element = document.querySelector(selector);

        if (element) {
          return element;
        }
      }

      return Array.from(document.querySelectorAll("input")).find((element) =>
        isEmailCodeInputByLabel(element)
      );
    };

    const firstMatch = findInput();

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const input = findInput();

      if (input) {
        cleanup();
        resolve(input);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待验证码输入框超时。"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function isEmailCodeInputByLabel(element) {
  const semanticText = [
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.id ? document.querySelector(`label[for="${escapeCssString(element.id)}"]`)?.textContent : "",
    element.closest("label")?.textContent
  ]
    .map(normalizeText)
    .join("");

  return semanticText.includes("验证码") || semanticText.toLowerCase().includes("code");
}

function dispatchOtpEvents(element, code) {
  element.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: code
  }));
  element.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: code
  }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  try {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", code);
    element.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      clipboardData
    }));
  } catch (_error) {
    // 某些页面或浏览器环境不允许构造剪贴板事件，忽略即可。
  }

  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function describeEmailCodeInput(element) {
  if (element.getAttribute("data-input-otp")) {
    return "input[data-input-otp='true']";
  }

  if (element.getAttribute("autocomplete")) {
    return `input[autocomplete="${element.getAttribute("autocomplete")}"]`;
  }

  if (element.name) {
    return `input[name="${element.name}"]`;
  }

  return "input";
}

function waitForRegisterSubmitButton(timeoutMs) {
  return new Promise((resolve, reject) => {
    const findButton = () => {
      const candidates = Array.from(
        document.querySelectorAll("button, input[type='submit'], [role='button']")
      );

      return candidates.find(isRegisterSubmitButton);
    };

    const firstMatch = findButton();

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const button = findButton();

      if (button) {
        cleanup();
        resolve(button);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待“注册”按钮超时。"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function isRegisterSubmitButton(element) {
  const tagName = element.tagName.toLowerCase();
  const type = (element.getAttribute("type") || "").toLowerCase();
  const text = normalizeText(element.textContent || element.value);
  const lowerText = normalizeEnglishText(element.textContent || element.value);
  const hasRegisterText =
    text === "注册" ||
    text === "创建账号" ||
    lowerText === "signup" ||
    lowerText === "register" ||
    lowerText === "createaccount";

  if (type === "submit" && hasRegisterText) {
    return true;
  }

  if (tagName === "button" && hasRegisterText) {
    return true;
  }

  return element.getAttribute("role") === "button" && hasRegisterText;
}

function waitForEmailInput(timeoutMs) {
  return new Promise((resolve, reject) => {
    const findInput = () => {
      const semanticSelectors = [
        "input[data-testid='email']",
        "input[type='email'][autocomplete='email']",
        "input[type='email'][name='email']",
        "input[autocomplete='email'][name='email']",
        "input[type='email']",
        "input[name='email']"
      ];

      for (const selector of semanticSelectors) {
        const element = document.querySelector(selector);

        if (element) {
          return element;
        }
      }

      return Array.from(document.querySelectorAll("input")).find((element) =>
        isEmailInputByLabel(element)
      );
    };

    const firstMatch = findInput();

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const input = findInput();

      if (input) {
        cleanup();
        resolve(input);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待邮箱输入框超时。"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function isEmailInputByLabel(element) {
  const semanticText = [
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.id ? document.querySelector(`label[for="${escapeCssString(element.id)}"]`)?.textContent : "",
    element.closest("label")?.textContent
  ]
    .map(normalizeText)
    .join("");

  return semanticText.includes("邮箱") || semanticText.toLowerCase().includes("email");
}

function describeEmailInput(element) {
  if (element.getAttribute("data-testid")) {
    return `input[data-testid="${element.getAttribute("data-testid")}"]`;
  }

  if (element.name) {
    return `input[name="${element.name}"]`;
  }

  if (element.type) {
    return `input[type="${element.type}"]`;
  }

  return "input";
}

async function runAutoFill(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const fields = buildFields(config);
  const clicks = normalizeClicks(config);
  const reads = normalizeReads(config);
  const result = {
    filled: [],
    failed: [],
    clicked: [],
    read: {}
  };

  for (const item of reads) {
    try {
      const element = await waitForElement(item.selector, config.waitMs);
      result.read[item.name] = readElement(element, item);
    } catch (error) {
      result.failed.push({
        selector: item.selector,
        action: "read",
        error: error.message
      });
    }
  }

  for (const field of fields) {
    try {
      const element = await waitForElement(field.selector, config.waitMs);
      setElementValue(element, field.value, field);
      dispatchInputEvents(element);
      result.filled.push({
        selector: field.selector,
        value: String(field.value)
      });
    } catch (error) {
      result.failed.push({
        selector: field.selector,
        action: "fill",
        error: error.message
      });
    }
  }

  if (clicks.length > 0 && config.delayBeforeClicksMs > 0) {
    await sleep(config.delayBeforeClicksMs);
  }

  for (const click of clicks) {
    try {
      const element = await waitForElement(click.selector, config.waitMs);
      element.click();
      result.clicked.push({ selector: click.selector });
    } catch (error) {
      result.failed.push({
        selector: click.selector,
        action: "click",
        error: error.message
      });
    }
  }

  return result;
}

function waitForEmailRegisterButton(timeoutMs) {
  return new Promise((resolve, reject) => {
    const findButton = () => {
      const candidates = Array.from(
        document.querySelectorAll("button, [role='button'], a")
      );

      return candidates.find(isEmailRegisterButton);
    };

    const firstMatch = findButton();

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const button = findButton();

      if (button) {
        cleanup();
        resolve(button);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待“使用邮箱注册”按钮超时。"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function isEmailRegisterButton(element) {
  const text = normalizeText(element.textContent);
  const lowerText = normalizeEnglishText(element.textContent);
  const hasChineseEmailRegisterText =
    text === "使用邮箱注册" ||
    text.includes("邮箱注册") ||
    text.includes("邮件注册");
  const hasEnglishEmailRegisterText =
    lowerText.includes("signupwithemail") ||
    lowerText.includes("signupbyemail") ||
    lowerText.includes("emailsignup") ||
    lowerText.includes("registerwithemail") ||
    lowerText.includes("registerbyemail") ||
    lowerText.includes("emailregister");
  const hasMailIcon = Boolean(
    element.querySelector("svg.lucide-mail, svg[class*='lucide-mail']")
  );

  // 使用稳定的语义线索匹配按钮，避免依赖 Tailwind 生成的长 class。
  return (
    hasChineseEmailRegisterText ||
    hasEnglishEmailRegisterText ||
    (hasMailIcon && (text.includes("邮箱") || lowerText.includes("email")))
  );
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function normalizeEnglishText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeConfig(config) {
  return {
    ...config,
    waitMs: toPositiveNumber(config.waitMs, 10000),
    delayBeforeClicksMs: toPositiveNumber(config.delayBeforeClicksMs, 0)
  };
}

function buildFields(config) {
  const fields = [];

  if (config.values && typeof config.values === "object" && !Array.isArray(config.values)) {
    for (const [key, value] of Object.entries(config.values)) {
      fields.push({
        selector: buildConventionSelector(key),
        value,
        source: "values"
      });
    }
  }

  if (Array.isArray(config.fields)) {
    for (const item of config.fields) {
      if (item?.selector) {
        fields.push(item);
      }
    }
  } else if (config.fields && typeof config.fields === "object") {
    for (const [selector, value] of Object.entries(config.fields)) {
      fields.push({ selector, value });
    }
  }

  return fields;
}

function normalizeClicks(config) {
  const clicks = [];

  if (Array.isArray(config.clicks)) {
    for (const item of config.clicks) {
      if (typeof item === "string") {
        clicks.push({ selector: item });
      } else if (item?.selector) {
        clicks.push(item);
      }
    }
  }

  if (config.submitSelector) {
    clicks.push({ selector: config.submitSelector });
  }

  return clicks;
}

function normalizeReads(config) {
  if (!Array.isArray(config.reads)) {
    return [];
  }

  return config.reads
    .map((item, index) => {
      if (typeof item === "string") {
        return { selector: item, name: item };
      }

      if (!item?.selector) {
        return null;
      }

      return {
        ...item,
        name: item.name || `read_${index + 1}`
      };
    })
    .filter(Boolean);
}

function buildConventionSelector(key) {
  const value = escapeCssString(key);
  return [
    `[data-crx-fill="${value}"]`,
    `[data-auto-fill="${value}"]`,
    `[name="${value}"]`
  ].join(", ");
}

function setElementValue(element, value, field) {
  const tagName = element.tagName.toLowerCase();
  const type = (element.getAttribute("type") || "").toLowerCase();

  if (type === "file") {
    throw new Error("浏览器安全限制不允许扩展直接填充文件选择框。");
  }

  if (type === "checkbox") {
    setNativeChecked(element, toBoolean(value));
    return;
  }

  if (type === "radio") {
    if (value === true || String(element.value) === String(value)) {
      setNativeChecked(element, true);
    }
    return;
  }

  if (tagName === "select") {
    setSelectValue(element, value);
    return;
  }

  if (element.isContentEditable || field.mode === "textContent") {
    element.textContent = String(value ?? "");
    return;
  }

  setNativeValue(element, String(value ?? ""));
}

function setSelectValue(element, value) {
  if (element.multiple && Array.isArray(value)) {
    const selectedValues = new Set(value.map(String));
    for (const option of element.options) {
      option.selected = selectedValues.has(option.value);
    }
    return;
  }

  element.value = String(value ?? "");
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function setNativeChecked(element, checked) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked"
  );

  if (descriptor?.set) {
    descriptor.set.call(element, checked);
  } else {
    element.checked = checked;
  }
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function readElement(element, item) {
  if (item.property === "text") {
    return element.textContent || "";
  }

  if (item.property === "html") {
    return element.innerHTML;
  }

  if (item.property === "checked") {
    return Boolean(element.checked);
  }

  if (item.property === "attribute") {
    return element.getAttribute(item.attribute || "value");
  }

  if ("value" in element) {
    return element.value;
  }

  return element.textContent || "";
}

function waitForElement(selector, timeoutMs) {
  return new Promise((resolve, reject) => {
    let firstMatch;

    try {
      firstMatch = document.querySelector(selector);
    } catch (error) {
      reject(new Error(`选择器无效：${selector}`));
      return;
    }

    if (firstMatch) {
      resolve(firstMatch);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);

      if (element) {
        cleanup();
        resolve(element);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`等待元素超时：${selector}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on", "是"].includes(String(value).toLowerCase());
}

function toPositiveNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function escapeCssString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
