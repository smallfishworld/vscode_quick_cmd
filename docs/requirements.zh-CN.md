# Command Deck v0.1.0 需求规格与技术方案

> 状态：首版实现基线。产品名 Command Deck，仓库 `smallfishworld/vscode_quick_cmd`。

## 1. 产品目标

将频繁输入的 Shell 命令整理到 VS Code 左侧 Activity Bar，用户可以通过图形界面或 JSON 定义、管理和点击执行，不额外打开脚本管理工具。首版要求原生、轻量、可维护、支持 Linux/macOS/Windows 的本地工作区及 VS Code Remote SSH 工作区。

**范围 P0：** 自定义活动栏、Tree View、全局/项目命令、多根工作区、分组、增删改、排序、命令执行、终端策略、配置校验与持久化、变量替换、错误处理、Workspace Trust、README/CI/单元测试。

**暂不支持 P1：** 拖拽排序、执行后状态/退出码、命令链/并行调度、交互式输入参数、命令历史、远程同步、机密信息管理。

## 2. 信息架构

```text
Command Deck (Activity Bar)
├── Global Commands             → User Settings JSON
│   ├── Build Tools              → group
│   │   └── Check Git            → command, click to run
│   └── ...
└── <Workspace Folder>           → .vscode/command-deck.json
    ├── Build & Test
    │   ├── Configure
    │   └── Build
    └── Version Control
        └── SVN Status
```

根节点固定按“全局、工作区顺序”呈现。分组和命令维持用户配置顺序。单击命令执行，右键调用管理菜单；侧边栏标题栏含添加命令、添加分组、刷新。配置错误呈现可点击修复入口。不存在配置时显示空目录且允许新增。

## 3. 交互流程

### 3.1 新增分组

点击 Add Group → 选择全局或项目范围（仅一个范围时直接选中）→ 输入分组名称（必填）→ 持久化 → Tree View 刷新。Esc 取消，不写入。

### 3.2 新增命令

点击 Add Command（也可右键分组）→ 选择范围/分组 → 依次输入名称、Shell 命令、描述、工作目录 → 选择终端策略 → 选择是否确认 → 存储并刷新。命令 ID 自动生成 UUID。可手工在 JSON 中编辑所有字段，包括 `enabled`。

### 3.3 执行命令

单击命令 → 从最新配置重新读取 ID 对应的命令 → 校验 Workspace Trust 与 `enabled` → 可选确认 → 展开工作区/文件/环境变量 → 获取专用终端（复用或新建）→ 显示终端并发送命令。用户可直接看到 Shell 输出；不冒充“已完成”或“执行成功”。

### 3.4 修改、删除、排序

右键命令可编辑、删除、上移/下移；右键分组可重命名、删除、排序；删除需确认。每次编辑先读取最新 JSON，遇到配置错误立即提示，不覆盖原始文件。GUI 更新文件后、用户直接改 JSON 后都要刷新 Tree View。

### 3.5 打开配置文件

项目节点右键 Open Configuration JSON：若文件不存在先写空模板，再打开 VS Code 编辑器。全局节点右键打开 User Settings JSON，提示编辑 `commandDeck.globalGroups` 数组。全局 GUI 操作使用 VS Code 配置 API 更新同一属性。

## 4. 持久化规范

### 4.1 项目文件 `.vscode/command-deck.json`

```json
{
  "version": 1,
  "groups": [
    {
      "id": "build",
      "name": "Build",
      "commands": [
        {
          "id": "compile",
          "name": "Compile",
          "command": "cmake --build build -j8",
          "description": "Build CMake target",
          "cwd": "${workspaceFolder}",
          "terminal": "reuse",
          "confirm": false,
          "enabled": true
        }
      ]
    }
  ]
}
```

- `version`：必填，当前只接受 1，防止未知版本被错误覆盖。
- `groups`：必填数组；`id`、`name`、`commands` 是分组必填字段。
- `commands[*]`：必填 `id`、`name`、`command`，可选 `description`、`cwd`、`terminal`、`confirm`、`enabled`。
- `terminal`：枚举 `reuse | new`，默认 `reuse`；`confirm` 默认 false；`enabled` 默认 true。
- 同一范围内 group ID 唯一、command ID 唯一。支持同名显示名称，不以名称作内部引用。
- JSON 必须标准语法（无注释）；项目文件提供 Schema 校验。
- 保存时统一缩进 2 格；无效 JSON 不被 GUI 覆盖；对 GUI 操作进行内存序列化以避免同扩展的并发修改互相覆盖。

### 4.2 全局配置

User Settings JSON 中设置：

```json
"commandDeck.globalGroups": [
  {"id": "tools", "name": "Tools", "commands": [{"id": "git", "name": "Git Status", "command": "git status"}]}
]
```

全局设置不包含外层 `version`。项目范围在仓库内，可随 Git/SVN 共享；全局配置跟随当前用户的 VS Code 用户设置。项目文件与全局命令互不覆盖。

## 5. 执行语义和安全边界

- 使用 VS Code `createTerminal()` + `sendText()`；不调用 Node `child_process` 执行命令，终端内的环境、交互输出由 VS Code 管理。
- `reuse`：对作用域+命令 ID 建立独立终端，终端关闭后自动释放映射；工作目录仅在创建时设置。
- `new`：每次新建终端，不复用。新增命令时可配置路径表达式。
- 默认工作目录：项目命令是对应项目根目录；全局命令优先当前编辑文件所在的工作区，否则第一工作区；没有工作区则使用终端默认工作目录。
- 占位符：`${workspaceFolder}`、`${workspaceFolderBasename}`、`${file}`、`${fileBasename}`、`${fileBasenameNoExtension}`、`${fileDirname}`、`${relativeFile}`、`${env:NAME}`。不存在的必需变量报错；不认识的 `${...}` 保持原样，交由 Shell 处理。
- 变量是字面替换，非 Shell 参数转义。命令编写者必须自行正确引用路径（含空格/特殊字符）；不应运行来源未知的命令。
- 启动和加载项目永不自动执行。Workspace Trust 未开启时，拒绝执行任何命令（包括全局）。
- `sendText()` 的 API 不直接返回进程状态、退出码及完成事件；v0.1.0 不展示这些指标，也不保证可检测终端忙碌。
- 尽量避免在项目 JSON 中写明文凭据；环境变量可由目标 Shell 提供。

## 6. 模块设计

```text
src/
├── extension.ts    注册菜单、命令及输入流程
├── tree.ts         TreeDataProvider、图标、刷新
├── store.ts        项目 JSON / 用户设置双来源、监听、写入串行化
├── model.ts        类型、校验、版本处理、错误
├── variables.ts    路径和环境变量解析（可单测）
└── terminal.ts     独立终端复用及安全执行
```

原则：UI 不直接持久化 JSON；终端执行从最新配置读取；所有外部配置必须校验；优先使用 VS Code 原生 API；不使用 Webview 或网络服务；确保远程工作区运行环境与打开的项目一致。

## 7. 可验收测试用例

| ID | 场景 | 预期 | 状态 |
|---|---|---|---|
| AC-01 | 打开 VS Code 扩展宿主 | 左侧出现 Command Deck 图标和 Commands 视图 | 待 GUI 验证 |
| AC-02 | 新建组和命令 | 列表显示、项目 JSON 持久化、重启仍存在 | 待 GUI 验证 |
| AC-03 | 单击命令 | 终端显示并发送正确命令，输出可见 | 待 GUI 验证 |
| AC-04 | 复用 / 新建 | `reuse` 同命令复用专用终端，`new` 每次新开 | 待 GUI 验证 |
| AC-05 | 修改项目 JSON | 保存后 Tree View 更新 | 待 GUI 验证 |
| AC-06 | 用户设置 JSON 修改 | Global Commands 刷新 | 待 GUI 验证 |
| AC-07 | 非法 JSON 或错误 version | 显示错误，不覆盖原数据 | 自动校验测试 + 待 GUI 验证 |
| AC-08 | 重复 group ID / command ID | 校验拒绝 | 已设计单元测试 |
| AC-09 | 无效终端策略 / 数据类型 | 校验拒绝 | 已设计单元测试 |
| AC-10 | 变量替换 | 工作区、当前文件、环境变量正确 | 已设计单元测试 |
| AC-11 | 缺失必要变量 | 提示错误、不发送命令 | 已设计单元测试 |
| AC-12 | 删除组或命令 | 弹确认、确认后消失，Esc 保留 | 待 GUI 验证 |
| AC-13 | 空工作区 | 全局可见；依赖工作区变量报错 | 待 GUI 验证 |
| AC-14 | 多根工作区 | 分别展示项目配置和终端根目录 | 待 GUI 验证 |
| AC-15 | Workspace Trust 关闭 | 点击命令时阻止执行 | 待 GUI 验证 |
| AC-16 | VS Code Remote SSH | 命令在远程工作区集成终端运行 | 待远程环境验证 |
| AC-17 | macOS/Windows/Linux | 插件可安装且基础命令可执行 | 待跨平台验证 |
| AC-18 | CI | 安装依赖、TS 编译、单元测试、VSIX 打包 | GitHub Actions 验证 |

## 8. 验收定义

**代码验收：** TypeScript 严格模式、模块边界清晰、无硬编码私有路径；静态编译和单元测试通过；每个持久化字段有文档；README 中英文，CI 输出 VSIX。

**功能验收：** AC-01 至 AC-15 完成后视为本地 v0.1.0 完整；AC-16/17 是环境兼容性验证，未做实测不能宣称已验证。首版不以终端“成功执行”状态为验收条件，因为目前 API 仅负责发送命令。
