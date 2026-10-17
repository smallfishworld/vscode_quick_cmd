# Quick Cmd v0.11.2

## 中文

- 修复 VS Code Marketplace 插件详情页显示默认占位图标的问题。
- 在 `package.json` 顶层新增 `icon: media/icon.png`，包含之前设计的苹果风终端与闪电图标，实际尺寸 **128 × 128 PNG**。
- 新增源代码及 VSIX 包内图标尺寸、文件内容一致性回归测试；保证后续打包不会遗漏图标。
- 仍只发布一个自动适配 VS Code 简体中文或英文界面的安装包 `quick-cmd-v0.11.2.vsix`，扩展 ID 与已有用户配置均保持不变。

## English

- Fixed the generic placeholder icon on the Visual Studio Marketplace extension details page.
- Declared `icon: media/icon.png` in the extension manifest and bundled the 128 × 128 PNG Apple-inspired terminal/lightning icon.
- Added regression checks verifying the icon's dimensions and exact bytes in the packaged VSIX.
- Still distributes one locale-aware installer, `quick-cmd-v0.11.2.vsix`, keeping the same extension identity and saved commands.
