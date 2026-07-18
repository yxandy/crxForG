# 内部网页调试填充器

这是一个本地 Chrome 扩展，用于内部测试调试网页：在扩展弹窗里输入目标网址和填充配置，点击后打开页面，等待约定元素出现并自动填充。

## 安装

1. 打开 Chrome 的扩展管理页：`chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录：`/Users/mac11/Documents/crxForG`

## 使用

在扩展弹窗里填写目标网址和 JSON 配置，然后点击“打开并填充”。

如果页面已经打开，也可以点击“填充当前页”，不再跳转网址。

可以先用本地测试页验证流程：

```text
file:///Users/mac11/Documents/crxForG/examples/test-page.html
```

使用 `file://` 本地测试页时，需要在扩展详情里打开“允许访问文件网址”。

## 推荐元素约定

简单场景建议在业务页面元素上约定以下属性之一：

```html
<input data-crx-fill="username">
<input data-auto-fill="password">
<input name="phone">
```

然后在配置里使用 `values`：

```json
{
  "waitMs": 10000,
  "navigationTimeoutMs": 30000,
  "values": {
    "username": "test_user",
    "password": "123456",
    "phone": "13800138000",
    "role": "admin"
  },
  "clicks": [
    "button[type='submit']"
  ]
}
```

扩展会按顺序匹配：

1. `[data-crx-fill="字段名"]`
2. `[data-auto-fill="字段名"]`
3. `[name="字段名"]`

## 复杂选择器

如果页面不能增加约定属性，可以使用 `fields` 指定 CSS 选择器：

```json
{
  "waitMs": 10000,
  "fields": [
    {
      "selector": "#loginAccount",
      "value": "test_user"
    },
    {
      "selector": "input[type='password']",
      "value": "123456"
    },
    {
      "selector": "select[name='role']",
      "value": "admin"
    }
  ],
  "clicks": [
    {
      "selector": ".login-button"
    }
  ]
}
```

## 读取页面元素

可以用 `reads` 在填充前读取页面元素，结果会用于执行统计，后续可以扩展为调试日志面板。

```json
{
  "reads": [
    {
      "name": "页面标题",
      "selector": "h1",
      "property": "text"
    },
    {
      "name": "当前账号",
      "selector": "input[name='username']",
      "property": "value"
    }
  ]
}
```

`property` 支持：

- `value`
- `text`
- `html`
- `checked`
- `attribute`

读取属性时可额外指定：

```json
{
  "name": "链接地址",
  "selector": "a.help",
  "property": "attribute",
  "attribute": "href"
}
```

## 注意事项

- 不能填充 `chrome://`、Chrome Web Store 等浏览器特殊页面。
- 文件上传框不能被扩展直接填充，这是浏览器安全限制。
- 如果元素在跨域 iframe 内，需要进一步增加 iframe 注入逻辑。
- React、Vue 等页面通常需要触发 `input` 和 `change` 事件，本扩展已在填充后自动派发这些事件。
