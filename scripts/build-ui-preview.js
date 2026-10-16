/*
 * 从扩展的真实 webview 模板生成 UI 预览页。
 *
 * 读取 media/list.html 与 media/editor.html，替换宿主占位符
 * （{{language}} / {{cssUri}} 等）为本地相对路径，并放宽 CSP，
 * 使页面可在普通浏览器中直接打开。DOM 结构保持与生产一致。
 *
 * 用法：node scripts/build-ui-preview.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const media = path.join(root, 'media');
const out = path.join(root, 'docs', 'ui-preview');

const PAGES = [
  {
    source: 'list.html',
    target: 'list.html',
    vars: {
      language: 'zh-CN',
      iconsUri: './codicon.css',
      cssUri: '../../media/list.css',
      i18nUri: '../../media/i18n.js',
      jsUri: '../../media/list-client.js',
    },
  },
  {
    source: 'editor.html',
    target: 'editor.html',
    vars: {
      language: 'zh-CN',
      cssUri: '../../media/editor.css',
      i18nUri: '../../media/i18n.js',
      jsUri: '../../media/editor-client.js',
    },
  },
];

fs.mkdirSync(out, { recursive: true });

for (const page of PAGES) {
  let html = fs.readFileSync(path.join(media, page.source), 'utf8');
  // 预览页在浏览器中打开，需放宽 CSP 并允许本地脚本/样式。
  html = html.replace(
    /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' \'unsafe-inline\' data:; font-src \'self\' data:;" />',
  );
  // 注入预览垫片：必须在客户端脚本之前定义 acquireVsCodeApi。
  html = html.replace(
    /(<script src="\{\{i18nUri\}\}"[^>]*><\/script>)/,
    '<script src="./shim.js"></script>\n    $1',
  );
  // 提案层：如需在视觉稿上先看未确认的改动，可临时放一份 proposal.css。
  // 该文件不属于扩展代码，确认改动落地后应删除。
  if (fs.existsSync(path.join(out, 'proposal.css'))) {
    html = html.replace(
      /<\/head>/,
      '  <link href="./proposal.css" rel="stylesheet" />\n  </head>',
    );
  }
  for (const [key, value] of Object.entries(page.vars)) {
    html = html.replaceAll('{{' + key + '}}', value);
  }
  // 清理未替换的 nonce 占位符。
  html = html.replaceAll(' nonce="{{nonce}}"', '');
  fs.writeFileSync(path.join(out, page.target), html);
  console.log('wrote', path.relative(root, path.join(out, page.target)));
}
