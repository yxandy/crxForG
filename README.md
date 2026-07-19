# 内部网页调试访问器

这是一个本地 Chrome 扩展，用于内部测试调试网页：点击扩展图标后，会在 Chrome 右侧打开固定侧边栏。在侧边栏里输入目标网址，点击“访问”后按步骤执行调试流程，并显示执行状态。

## 安装

1. 打开 Chrome 的扩展管理页：`chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录：`/Users/mac11/Documents/crxForG`

## 配置

点击侧边栏右上角“配置”，或在扩展图标上右键打开“选项”。

配置项包括：

- `mailmanage API 地址`：默认 `https://mailmanage.yxandy.cc.cd`
- `NAS 验证码 API 地址`：默认 `http://10.189.111.82:8787`
- `Bearer Token`：填写共用 Token，用于 mailmanage 和 NAS 验证码接口
- `注册密码`：第九步统一填入的密码

Token 和注册密码只保存在当前浏览器本地，不会写入项目文件，也不要提交到 git。

## 使用

点击扩展图标打开右侧侧边栏，在侧边栏里填写随机延迟范围和目标网址，然后点击“访问”。

延迟范围单位是毫秒。例如最小延迟填 `200`、最大延迟填 `400`，每一步操作之间会随机等待 `200` 到 `400` 毫秒。

当前流程包含九步：

1. 打开目标网址，成功后显示“第一步：网址打开成功”
2. 查找并点击“使用邮箱注册”按钮，成功后显示“第二步，准备邮箱注册”
3. 调用 `mailmanage` 接口领取 G 邮箱，成功后显示“第三步：领取邮箱成功”
4. 将领取到的邮箱填入邮箱输入框，成功后显示“第四步：邮箱填入成功”
5. 查找并点击“注册”按钮，成功后显示“第五步：注册按钮已点击”
6. 调用 NAS 验证码接口轮询邮箱验证码，成功后显示“第六步：获取邮箱验证码成功”
7. 将验证码填入验证码输入框，成功后显示“第七步：验证码填入成功”
8. 调用 `mailmanage` 状态回写接口，将邮箱标记为已注册 G，成功后显示“第八步：注册成功状态已回写”
9. 随机生成美国男性常用姓名，并填入名字、姓氏和配置好的统一密码，成功后显示“第九步：用户姓名和密码已填入”

第二步不会依赖按钮上的整串样式 class，而是用按钮文本“邮箱注册”、`Sign up with email` 和邮件图标 `lucide-mail` 这类更稳定的语义线索查找。

第四步不会依赖输入框上的整串样式 class，而是优先使用 `data-testid="email"`、`type="email"`、`autocomplete="email"`、`name="email"` 等语义属性查找。

第五步不会依赖按钮上的整串样式 class，而是优先使用 `button[type="submit"]` 和按钮文本“注册”、`Sign up`、`Register` 等语义线索查找。

第六步默认最多等待 120 秒，每 5 秒查询一次。等待阶段不会消费验证码，拿到的验证码会暂存在当前浏览器本地。

第七步不会依赖验证码输入框上的样式 class，而是优先使用 `data-input-otp="true"`、`autocomplete="one-time-code"`、`name="code"`、`maxlength="6"` 等语义属性查找。

第八步会调用 `POST /api/internal/g-email/status`，传入 `email` 和 `isRegisteredG: true`。如果回写失败，侧边栏会保留前面已完成步骤并显示错误。

第九步内置 50 个美国男性常用名字和 50 个美国常见姓氏。名字输入框优先使用 `data-testid="givenName"`、`autocomplete="given-name"`、`name="givenName"` 查找；姓氏输入框优先使用 `data-testid="familyName"`、`autocomplete="family-name"`、`name="familyName"` 查找；密码输入框优先使用 `data-testid="password"`、`type="password"`、`name="password"` 查找。

可以先用本地测试页验证流程：

```text
file:///Users/mac11/Documents/crxForG/examples/test-page.html
```

使用 `file://` 本地测试页时，需要在扩展详情里打开“允许访问文件网址”。

## 注意事项

- 不能访问 `chrome://`、Chrome Web Store 等浏览器特殊页面。
- 不写协议时会默认使用 `https://`。
- 这一版侧边栏暂时只保留访问能力，自动填充入口后续再加回来。
- 固定侧边栏依赖 Chrome Side Panel API，需要 Chrome 114 或更高版本。
