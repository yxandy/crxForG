(() => {
  if (window.__internalAutoFillerLoaded) {
    return;
  }

  window.__internalAutoFillerLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "AUTO_FILL") {
      return false;
    }

    runAutoFill(message.payload)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });
})();

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
