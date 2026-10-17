# Quick Cmd v0.11.1

## 中文

- 修复 VS Code Marketplace 首次上传报错：`The category 'Productivity' is not available in language 'en-us'`。
- 将扩展分类改为 VS Code 官方支持的 `Other`，不再使用无效的 `Productivity`。
- 构建前验证分类合法性，VSIX 解包校验以及单元测试也会检查分类，避免类似问题再次发生。
- 继续只提供一个中英文自动适配的 VSIX：`quick-cmd-v0.11.1.vsix`。沿用原扩展 ID，不会删除已保存的快捷命令。

## English

- Fixed initial VS Code Marketplace upload failure: `The category 'Productivity' is not available in language 'en-us'`.
- Changed the extension category to supported value `Other`.
- Added pre-build validation, packaged manifest verification, and regression tests to reject unsupported Marketplace categories.
- Still ships a single VSIX, `quick-cmd-v0.11.1.vsix`, switching between Chinese and English automatically and preserving saved commands.
