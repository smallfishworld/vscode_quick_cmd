# Quick Cmd P1 开发与验收说明（v0.2.0）

## 范围

1. 变量插值：`${workspaceFolder}`、`${file}`、`${fileDirname}`、`${fileBasename}`、`${fileBasenameNoExtension}`、`${relativeFile}`、`${env:NAME}`、`${input:name}`。
2. 使用系统 Shell 的字面量安全引号；Windows cmd.exe 对危险字符明确拒绝。
3. 终端模式：`new`、`reuse`、`active`，复用仅在 Shell Integration 确认空闲后执行，否则新建。
4. 可选环境变量、执行前输入、执行确认、图标、描述。
5. 搜索命令、逐条复制、命令和分组上下排序；全局/项目配置 JSON 导入导出。
6. 快捷键：搜索命令默认快捷键与单命令 `keybindings.json` 片段；支持指定命令 ID 和作用域 ID。
7. Shell Integration 状态显示及通过关闭插件专用终端停止执行。

## 配置兼容

延续 `version: 1`，所有 v0.1.0 字段继续可用。命令对象可新增 `terminal`（`new`/`reuse`/`active`）、`confirm`、`description`、`icon`、`env` 等可选字段。不支持格式错误的文件静默覆盖。

## P1 验收场景

- 旧 `.vscode/quick-cmd.json` 仍可读取并执行。
- `echo ${input:name}` 在执行前询问参数；参数按配置的 Shell 自动安全引用。
- 带有空格及单引号的路径可正确展开；cmd.exe 不接受不安全的 `%`、`!`、`&`、`|` 等插值。
- 独立终端模式每次执行新建；复用模式在 Shell Integration 未确认空闲时不会发送命令到旧终端。
- 活动终端可能忙碌时需用户二次确认，且不能覆盖用户已有的 `cwd/env`。
- JSON 导入必须验证格式并明确确认才覆盖，导出包含命令及分组 ID。
- 快捷键可通过 JSON 片段绑定任意命令，搜索框可按分组、作用域和命令文本查找。
- 在 Shell Integration 存在时能显示运行中与退出码；缺失时不伪造成功状态。
- 代码语法检查和单元测试均通过，GitHub Actions 能打包并发布 VSIX。

## 明确限制

- 不可靠猜测未支持 Shell Integration 的终端状态。
- 停止命令的方式是关闭插件创建的专用终端，不停止用户自己切换过去的活动终端。
- 不提供命令执行沙箱；外部来源的配置必须由用户主动执行，Workspace Trust 不允许时禁止执行。
- 本阶段不支持复杂 DAG、条件式任务依赖和执行历史。这些属于 P2。
