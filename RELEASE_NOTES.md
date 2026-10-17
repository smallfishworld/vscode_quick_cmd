# Quick Cmd v0.11.5

## 中文

- 将快捷命令持久化方式从 VS Code 全局状态数据库改为插件专属全局存储目录中的 `config.json`，可直接查看、复制和备份。
- 不提供自定义配置路径；不导入旧版 `globalState` 数据，也不增加卸载时保留数据机制。
- 仅当 `config.json` 不存在时，首次打开 Quick Cmd 自动创建文件并加载中文或英文的完整默认预设（6 组、43 条）。
- 已有文件（即使命令列表为空）绝不自动覆盖；读取 JSON 后严格校验，文件损坏或访问失败时报告错误。
- 写入采用同目录临时文件加重命名，读改写在扩展宿主内串行化；添加失败恢复、首次运行、文件持久化和编辑操作回归测试。
- 保持原有双语 VSIX 和扩展 ID；Marketplace 继续由发布者手动上传。

## English

- Save commands in a readable `config.json` under the extension's VS Code global storage directory instead of the VS Code `globalState` database.
- No configurable path, legacy database migration or special retention when uninstalling.
- Only if the JSON does not exist, initialize 6 groups/43 commands from the installed Chinese or English default presets.
- Never overwrite an existing JSON file, even if intentionally empty; report malformed JSON or filesystem failures.
- Use an adjacent temporary file and rename for writes, serialize modifications within the extension host and cover persistence, errors and first-run behavior with tests.
- Preserve the existing extension identity and multilingual installer; Marketplace publication remains manual.
