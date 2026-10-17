# Quick Cmd 设计说明

基线版本：0.11.2。需求来源为 [spec.md](spec.md)，开发流程和项目约束见 [agent.md](../agent.md)。界面视觉稿见 [ui-preview/index.html](ui-preview/index.html)（由扩展自身的 webview 模板与客户端脚本渲染，非手绘，说明见 [ui-preview/README.md](ui-preview/README.md)）。

## 1. 架构与职责

| 模块                                   | 职责                                            | 依赖边界                               |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `src/extension.js`                     | 装配 VS Code 接口、注册命令、参数解析与发送入口 | 不直接生成表单 HTML，不承担配置校验    |
| `src/model.js`                         | 数据校验、分组/命令操作、排序                   | 纯模型，不依赖 VS Code                 |
| `src/store.js`                         | 全局状态读写、串行更新                          | 不访问项目文件；读返回独立副本         |
| `src/list.js`、`media/list*` | 可移动 Webview 命令列表、字号、悬停行尾操作、拖拽及键盘操作 | ID 在宿主重新校验，视图不访问存储或执行 Shell |
| `src/editor.js`                        | 编辑会话、草稿、保存冲突、侧栏/宽编辑器协调     | 对客户端消息校验，保存仍通过模型与存储 |
| `media/editor-client.js`               | 表单、步骤、校验反馈、环境变量表格              | 通过消息交互，不直接操作终端或文件     |
| `src/terminal.js` / `src/variables.js` | 终端管理、状态观测、目录与变量展开              | 不把“已发送”视为“执行成功”             |
| `src/transfer.js`                      | 显式 JSON 导入/导出                             | 导入校验后确认替换；无项目配置监听     |
| `src/i18n.js` / `media/i18n.js`        | 发行版语言解析、共享翻译和错误本地化            | 构建语言覆盖宿主语言；开发时跟随宿主   |

## 2. 数据与一致性

- `globalState` 的 `quickCmd.globalConfig` 保存唯一全局集合；版本字段保持 `1`。
- `ConfigStore.update` 将所有读—修改—校验—写入串行化，失败后队列可继续；错误配置不写入。
- 模型 ID 在重命名和组间移动后不变。树使用稳定标识，撤销前比较当前配置与操作后的快照，防止回滚其他修改。
- 项目文件夹仅作为执行目录或文件变量上下文；不是配置保存范围。
- JSON 导入先解析和校验，再请求替换确认，不主动执行导入的命令。

## 2.1 仓库级默认命令样例

`presets/` 保存可选的双语 JSON 命令集合：完整 6 组及 Git 单组两个集合，每个集合均符合 `src/model.js` 的 `validateConfig` 约束，使用稳定唯一 ID、单步骤、`${workspaceFolder}` 工作目录以及 `reuse` 终端策略。`test/presets.test.js` 保障格式、双语命令等价和高风险操作确认标志。预设是仓库示例文件，不由 `src/store.js` 自动初始化，也不改变 `src/transfer.js` 的“确认后完整替换”语义；用户必须主动下载并导入。POSIX/Linux 专属命令在文档中标明平台限制。

## 3. 编辑会话与消息

会话包含选择信息、唯一 `token`、递增 `revision`、当前 `raw` 草稿、`baseline` 保存基线和 `original` 存储快照。草稿写入当前 VS Code 工作区状态，不能触发命令执行。

| 消息                  | 方向                  | 含义                                             |
| --------------------- | --------------------- | ------------------------------------------------ |
| `ready` / `load`      | 客户端请求 / 宿主响应 | 初始化当前草稿及基线                             |
| `draft` / `revision`  | 双向                  | 提交草稿、检查会话与版本并确认版本               |
| `save` / `saved`      | 客户端请求 / 宿主响应 | 保存提交快照，返回对应基线；后续输入仍可能未保存 |
| `error`               | 宿主到客户端          | 保留输入并显示本地化错误                         |
| `expand` / `readOnly` | 客户端请求 / 宿主广播 | 宽编辑器接管编辑，侧栏只读同步                   |
| `reopen`              | 客户端到宿主          | 处理草稿后重新读取已保存版本                     |

切换对象依次处理当前草稿、读取目标并生成新会话。保存比较 `original` 与存储当前值；不同则拒绝覆盖。宽编辑器与侧栏共享会话，只有宽编辑器可写，关闭后恢复侧栏写入。

表单把末尾回车作为组级设置，序列化时映射为中间步骤 `execute: true` 和最后一步的实际选项；布局操作不会改动选项。无效环境变量行通过草稿元数据保留，不作为有效环境变量写入。

编辑栏仍由 `quickCmd.editing` 控制，启动为 false。行尾铅笔和新建操作打开编辑栏，命令主体始终按保存配置发送；不再使用全局编辑模式或在列表顶部切换点击含义。关闭编辑栏仍先等待保存并处理草稿，取消或失败保持编辑。标题栏提供两个关闭入口：`quickCmd.closeEditor`（保存并完成编辑，`$(check)`）调用 `editor.saveAndClose()`，先保存草稿再退出，保存失败保持编辑不丢输入；`quickCmd.closeEditorView`（关闭编辑，`$(close)`）调用 `editor.close()`，脏数据时弹保存/放弃/取消确认。两者退出都经 `teardown()`，除清除会话外还执行 `quickCmd.commands.focus`，把焦点交回命令列表视图，不停留在终端或空编辑视图。

高级设置区（`<details id="advanced">`）默认展开。命令图标选择器渲染约 30 个 Codicon 预设加自定义名称，选项值与命令列表 `glyph()` 使用同一套 Codicon 字体（`media/codicons/codicon.css` 或 `node_modules/@vscode/codicons/dist`，经 `webview.asWebviewUri` 注入，CSP 放行 `font-src`），因此编辑表单与列表两处显示一致。


原生右键菜单通过 `webview/context` 和行级 `data-vscode-context` 声明，由 VS Code 在鼠标处定位。右键只选中目标，不阻止原生事件、不请求 QuickPick。菜单命令携带 token、类型及 ID，宿主重新校验会话、动作白名单与当前数据后重建节点，忽略客户端作用域和命令文本。

## 4. 紧凑列表与视图容器

列表改用 WebviewView：原生 TreeItem 无法独立控制字号，WebviewView 允许在保留字体层级的同时使用宿主界面字体。继续使用原生视图容器、标题栏菜单与集成终端，允许用户将列表与编辑栏移动到其他容器，不创建独立浮窗。

`media/list.html`、`list.css`、`list-client.js` 只负责呈现和操作意图。分组与命令均使用 `--vscode-foreground`，取消专用颜色及数量；列表名称与摘要继承 `--vscode-font-family`、`--vscode-font-weight`；字号默认继承 `--vscode-font-size`，命令比宿主小 1px、分组比命令大 2px，最小行高 22px。`quickCmd.listFontSize=0` 表示跟随宿主，非零值覆盖命令字号。分组展开时，子项容器 `[role=group]` 的 `::before` 在折叠箭头中心下方画一条 `--vscode-tree-indentGuidesStroke` 缩进竖线。行尾只保留编辑、运行按钮，在悬停或键盘聚焦时显示，预留固定宽度，正文 flex 收缩并省略；删除走行级右键的原生上下文菜单（`webview/context` 的 `deleteCommand`），行尾不再有删除按钮。

消息包含会话 token、对象类型和 ID。宿主每次从当前全局配置重新解析对象，只允许预定义操作；不信任客户端传来的命令文本、作用域或任意 VS Code 命令。异步刷新使用序号避免较旧数据覆盖新状态。折叠组、选中项、滚动位置在刷新和隐藏后保留。

拖拽使用 ID 载荷，宿主调用模型 `moveDrop`，保存后刷新并保留定位；撤销比较快照，不覆盖后续修改。键盘支持上下选择、左右展开/折叠、回车发送、F2 编辑；分组和命令均有适当 tree/treeitem/按钮标签。图标使用本地 Codicon 字体资产和本地 SVG，不依赖在线资源或外部运行时库。

## 5. 终端与变量

新建终端始终使用专用终端；复用仅在 Shell 集成确认空闲且目录/环境签名一致时进行。活动终端不能应用专用目录或环境，状态不确定时提示。关闭专用终端是停止操作的实现边界。

跟踪最近文本编辑器 URI（Uniform Resource Identifier，统一资源标识符），避免宽 Webview 激活后文件变量丢失。全局命令在多根工作区中按最近文本文件确定目录，缺省取第一个目录。

命令变量按 `posix`、`powershell` 或 `cmd` 规则引用；目录和环境使用纯文本展开。步骤合并发送保持明确边界，不承诺独立步骤进程管理。

## 6. 多语言单包构建

源树保留 `package.nls.json`（默认英文）与 `package.nls.zh-cn.json`（简体中文）；VS Code 自动根据界面语言解析贡献项（命令、菜单和设置）。运行时代码和 Webview 使用 `vscode.env.language` 初始化共享词典（`media/i18n.js`），支持 `zh` 前缀的中文语言代码，其他语言回退英文；不再使用 `quickCmdBuildLanguage` 固定语言。切换 VS Code 显示语言并重载后生效，用户创建的命令内容不参与翻译。

`scripts/package-variants.js` 在 `.build/unified` 建立唯一隔离目录（保留脚本路径作为内部构建入口）：

1. 复制运行时代码和所需说明，不复制测试、开发依赖、工程文档或构建脚本。
2. 保持原始 `publisher`、`name`、`version`，不写入语言固定字段 `quickCmdBuildLanguage`。
3. 同时放入英文默认 `package.nls.json` 与简体中文 `package.nls.zh-cn.json`。
4. 调用锁定的 VSCE（Visual Studio Code Extensions 打包工具），只输出 `dist/quick-cmd-v<version>.vsix`，构建前清空旧 `dist/`，避免遗留文件上传。
5. `scripts/verify-packages.py` 校验唯一 ZIP、版本、双语 NLS 资源、扩展标识、预设及运行时文件，检查扩展分类满足 Marketplace 官方枚举（当前仅 `Other`），并验证没有多余 VSIX 后生成仅一行的 `SHA256SUMS`。构建时也会提前检查分类，防止无效分类造成上传失败。扩展市场图标采用 `media/icon.png`（128×128 PNG），通过 `package.json` 顶层 `icon` 字段引用，与 `media/activitybar.svg` 独立；单包测试与解包测试校验 PNG 尺寸、路径及源文件一致。

单包使用现有扩展标识 `smallfishworld.vscode-quick-cmd`，覆盖升级不会改变 `globalState` 键，也不自动执行或删除保存命令。

## 7. 持续集成与发布

CI（Continuous Integration，持续集成）在合并请求和主分支执行安装、检查、测试、单包打包与解包验证。发布工作流使用同一命令，先上传工作流产物，再创建含唯一安装包和校验和的草稿发布，最后转为正式发布。商店发布步骤仅在 `main` 分支且 Actions 变量 `MARKETPLACE_PUBLISH_ENABLED=true` 时运行，上传与 GitHub Release 相同的多语言 VSIX。优先使用加密 GitHub Secret `VSCE_PAT` 进行认证（仅以环境变量传入，无明文输出），否则尝试 Marketplace 信任的 GitHub OIDC；验证和构建步骤仍不依赖密钥。Azure DevOps 全局 PAT 计划于 2026-12-01 退休，长期迁移至 OIDC/Entra 身份认证。

v0.6.0 按用户要求执行一次历史重置：仅删除已核实的旧版本 `v0.2.0`、`v0.3.0`、`v0.3.1`、`v0.4.0`、`v0.5.0` 及其标签。清理发生在新包通过验证并上传草稿之后。固定白名单不会匹配未来版本或其他标签；普通版本发布不清理历史。已正式发布的同版本不会在重复运行时被覆盖。

## 8. 测试边界

模型测试验证约束与排序，存储测试验证全局单集合和并发，终端测试验证发送/状态边界，会话与 DOM 测试验证草稿和表单。构建测试验证单包内同时具备中文及英文资源、扩展标识稳定与源树不被改写；列表 DOM 测试验证同色、字号层级、悬停操作、不显示计数、消息隔离及折叠/拖拽/键盘交互。

实际 VS Code 的深浅色、高对比度、选中行对比度、原生拖拽和不同侧栏宽度需要单独人工或图形宿主验收，不以 DOM 测试冒充已完成。

本次按用户明确要求替换已发布的 0.7.1：两个语言包构建验证后，仅当旧发布 ID 为 `413791301` 且目标提交为 `a9bc0c492691435170fee1507ae935a348d0d9b7` 时删除旧发布及标签，随后从修正提交重新创建同版本发布。后续重跑保留已发布的修正版。
