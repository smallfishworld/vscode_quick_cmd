# Quick Cmd v0.11.6

## 中文

- 修复命令变量在双引号中被错误转义、导致输入中的 Shell 表达式执行的问题。占位符须放在引号和转义之外；包含嵌套展开或 here-document 的变量模板会在发送前拒绝。
- “保存并完成编辑”继续保存写入期间到达的新草稿，直至全部保存；后续保存失败则保留编辑会话。
- 全局 JSON 更新和首次默认预设初始化增加跨窗口、跨进程写入协调，避免不同窗口的修改互相覆盖；写入者退出后可恢复。
- 终端复用比较展开后的环境变量及 Shell 集成报告的实际工作目录；缺少目录信息或配置不匹配时新建终端。
- 存在未提交文本的终端不再复用；多步骤的中间执行事件也不会把末行预填误判为空闲。
- 保留 v0.11.5 的 config.json 存储、首次预设和单个中英文自适应安装包。

## English

- Reject command-variable interpolation inside quotes or escapes, and variable templates containing nested shell expansion or here-documents, before sending text to a shell.
- Save and Finish Editing continues saving drafts received during pending writes; failures preserve the editor session.
- Coordinate JSON updates and first-run preset initialization across windows and extension host processes, with recovery after a writer exits.
- Reuse terminals only when expanded environment values and the actual Shell Integration working directory match; otherwise create a new terminal.
- Never reuse terminals with staged text. Intermediate multiline execution events cannot clear the final line's staged state.
- Preserve v0.11.5 JSON storage, first-run presets and the single multilingual installer.

Validation covers automated tests, independent Node processes, shell argument handling, and VSIX content verification. Actual VS Code multi-window, Remote SSH and graphical host acceptance have not been performed. Marketplace publication follows the existing repository workflow settings.
