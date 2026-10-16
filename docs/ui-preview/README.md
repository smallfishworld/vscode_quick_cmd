# Quick Cmd UI 视觉稿（由扩展代码渲染）

基线版本：0.7.1。打开 [ui-preview/index.html](ui-preview/index.html) 查看。

## 为什么不用手绘

手绘的视觉稿会与实现逐渐偏离（图标、字号、间距、文案、DOM 结构）。本目录改为**直接运行扩展自己的 webview 代码**：每个视图都由 `media/list.html` / `media/editor.html` 模板、`media/*.css` 与 `media/*-client.js` 在 iframe 中真实渲染，DOM、类名、图标、文案与生产环境完全一致。

垫片（`ui-preview/shim.js`）只补三件事，不重绘任何界面：

1. `acquireVsCodeApi` 的最小实现（`postMessage` 记入 `window.__outbox`）。
2. 注入 VS Code 主题变量（Default Light+ / Dark+ 参考值）。
3. 在脚本加载后派发宿主消息 fixture（字段与 `src/list.js`、`src/editor.js` 的载荷一致）。

## 视图与参数

| 文件 | 内容 | URL 参数 |
| ---- | ---- | -------- |
| `ui-preview/index.html` | 组合页：默认状态、编辑状态（编辑视图覆盖分组）、空态、高级设置，浅色/深色并排 | — |
| `ui-preview/list.html` | 分组列表视图（`quickCmd.commands`） | `?theme=light\|dark&fixture=list` |
| `ui-preview/editor.html` | 命令编辑视图（`quickCmd.editor`） | `?theme=light\|dark&fixture=editor\|editorEmpty` |

`index.html` 的窗口外壳只是示意，用于还原 VS Code 中的观感：活动栏图标取自 `media/activitybar.svg`，视图**标题栏与右上角工具栏**按 `package.json` 的 `contributes.views` 与 `menus.view/title`（`navigation@0…8`）绘制——这两部分由 VS Code 外壳渲染，不在 webview 内，扩展代码无法生成。视图**主体**全部来自扩展代码。

## 重新生成

模板或样式改动后重新生成预览页：

```
node scripts/build-ui-preview.js
```

该脚本读取 `media/*.html`，替换宿主占位符（`{{cssUri}}` 等）为本地相对路径、放宽 CSP，并注入 `shim.js`。`codicon.css` / `codicon.ttf` 来自 `@vscode/codicons` 0.0.46-24（与扩展 webview 加载的字体同版本），已随本目录提供。

## 先改视觉稿，再改代码

界面改动的流程是：先在视觉稿上体现并核对，再落到生产代码（见 [agent.md](../../agent.md) 第 4 步）。做法是把待确认的改动写进预览专用的 `ui-preview/proposal.css`（或 `index.html` 的外壳部分），不改 `media/*` 与 `package.json`；`build-ui-preview.js` 会在 `proposal.css` 存在时自动挂载它。确认后再改生产代码，并删除 `proposal.css`。

## 边界

预览在普通浏览器中运行，使用参考主题色，仅用于视觉核对。真实 VS Code 中的主题色、字体、高对比度、原生拖拽与不同侧栏宽度仍需人工验收（见 [design.md](design.md) 第 8 节）。
