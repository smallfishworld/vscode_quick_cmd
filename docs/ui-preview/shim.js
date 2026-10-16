/*
 * UI 预览垫片（harness，非扩展代码）
 *
 * 作用：在浏览器里直接运行扩展自己的 webview 客户端脚本。
 * 只做三件事，其余全部交给 media/*-client.js 与 media/*.css：
 *   1. 提供 acquireVsCodeApi 的最小实现（postMessage 记录到 __outbox）
 *   2. 注入 VS Code 主题变量（Default Light+ / Dark+ 参考值）
 *   3. 在脚本加载后，把宿主本应发送的消息派发到 window
 *
 * 参数：?theme=light|dark  &fixture=list|editor|editorEmpty
 */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const fixture = params.get('fixture') || 'list';

  /* ---- VS Code 主题变量（Default Light+ / Dark+ 参考值） ---- */
  const LIGHT = {
    '--vscode-foreground': '#3b3b3b',
    '--vscode-descriptionForeground': '#717171',
    '--vscode-errorForeground': '#a1260d',
    '--vscode-focusBorder': '#0090f1',
    '--vscode-font-family': 'system-ui, "Segoe UI", sans-serif',
    '--vscode-font-size': '13px',
    '--vscode-font-weight': 'normal',
    '--vscode-editor-font-family': 'Consolas, "Courier New", monospace',
    '--vscode-sideBar-background': '#f8f8f8',
    '--vscode-list-hoverBackground': '#e8e8e8',
    '--vscode-list-inactiveSelectionBackground': '#e4e6f1',
    '--vscode-list-activeSelectionBackground': '#0060c0',
    '--vscode-list-activeSelectionForeground': '#ffffff',
    '--vscode-list-dropBackground': '#d6ebff',
    '--vscode-tree-indentGuidesStroke': '#a9a9a9',
    '--vscode-toolbar-hoverBackground': 'rgba(0, 0, 0, 0.06)',
    '--vscode-button-background': '#007acc',
    '--vscode-button-hoverBackground': '#0062a3',
    '--vscode-button-foreground': '#ffffff',
    '--vscode-button-secondaryBackground': '#ffffff',
    '--vscode-button-secondaryForeground': '#3b3b3b',
    '--vscode-button-secondaryHoverBackground': '#f2f2f2',
    '--vscode-input-background': '#ffffff',
    '--vscode-input-foreground': '#3b3b3b',
    '--vscode-input-border': '#cecece',
    '--vscode-panel-border': '#e5e5e5',
    '--vscode-widget-border': '#c8c8c8',
    '--vscode-testing-iconPassed': '#388a34',
    '--vscode-textLink-foreground': '#006ab1',
  };
  const DARK = {
    '--vscode-foreground': '#cccccc',
    '--vscode-descriptionForeground': '#9d9d9d',
    '--vscode-errorForeground': '#f48771',
    '--vscode-focusBorder': '#007fd4',
    '--vscode-font-family': 'system-ui, "Segoe UI", sans-serif',
    '--vscode-font-size': '13px',
    '--vscode-font-weight': 'normal',
    '--vscode-editor-font-family': 'Consolas, "Courier New", monospace',
    '--vscode-sideBar-background': '#252526',
    '--vscode-list-hoverBackground': '#2a2d2e',
    '--vscode-list-inactiveSelectionBackground': '#37373d',
    '--vscode-list-activeSelectionBackground': '#04395e',
    '--vscode-list-activeSelectionForeground': '#ffffff',
    '--vscode-list-dropBackground': '#062f4a',
    '--vscode-tree-indentGuidesStroke': '#585858',
    '--vscode-toolbar-hoverBackground': 'rgba(255, 255, 255, 0.1)',
    '--vscode-button-background': '#0e639c',
    '--vscode-button-hoverBackground': '#1177bb',
    '--vscode-button-foreground': '#ffffff',
    '--vscode-button-secondaryBackground': '#3a3d41',
    '--vscode-button-secondaryForeground': '#cccccc',
    '--vscode-button-secondaryHoverBackground': '#45494e',
    '--vscode-input-background': '#3c3c3c',
    '--vscode-input-foreground': '#cccccc',
    '--vscode-input-border': '#3c3c3c',
    '--vscode-panel-border': '#80808059',
    '--vscode-widget-border': '#454545',
    '--vscode-testing-iconPassed': '#89d185',
    '--vscode-textLink-foreground': '#3794ff',
  };
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme === 'dark' ? DARK : LIGHT)) {
    root.style.setProperty(name, value);
  }
  root.setAttribute('data-preview-theme', theme);

  /* ---- 假宿主 ---- */
  const outbox = [];
  window.__outbox = outbox;
  // list-client 在顶层读取 getState()，因此种子状态必须先于客户端脚本就位。
  window.__seedState =
    fixture === 'list'
      ? { collapsed: ['g3'], selected: 'c:c2', scroll: 0 }
      : undefined;
  window.acquireVsCodeApi = function () {
    return {
      postMessage: (message) => outbox.push(message),
      getState: () => window.__seedState,
      setState: (state) => {
        window.__seedState = state;
      },
    };
  };

  /* ---- 宿主消息 fixture（字段与 src/list.js、src/editor.js 的载荷一致） ---- */
  // 步骤：中间步骤 execute 为 true，最后一步由末尾回车决定；预览统一为 true。
  const steps = (commands) =>
    commands.map((command) => ({ command, execute: true }));
  const FIXTURES = {
    list: {
      type: 'model',
      token: 'preview-token',
      fontSize: 0,
      groups: [
        {
          id: 'g1',
          title: '构建',
          commands: [
            {
              id: 'c1',
              title: '构建项目',
              icon: 'tools',
              running: false,
              preview: 'npm ci ; npm run build',
              status: '',
              tooltip:
                '编译并打包前端产物\n1. npm ci ↵\n2. npm run build ↵\n工作目录: ${workspaceFolder}',
            },
            {
              id: 'c2',
              title: '启动开发服务器',
              icon: 'terminal',
              running: false,
              preview: 'npm run dev --workspace=web',
              status: '',
              tooltip: '1. npm run dev --workspace=web ↵',
            },
          ],
        },
        {
          id: 'g2',
          title: 'Git',
          commands: [
            {
              id: 'c3',
              title: '提交',
              icon: 'terminal',
              running: false,
              preview: 'git add -A ; git commit',
              status: '',
              tooltip: '1. git add -A ↵\n2. git commit ↵',
            },
            {
              id: 'c4',
              title: '推送',
              icon: 'loading',
              running: true,
              preview: 'git push origin main',
              status: '运行中',
              tooltip: '运行中\n1. git push origin main ↵',
            },
          ],
        },
        {
          id: 'g3',
          title: 'Docker',
          commands: [
            {
              id: 'c5',
              title: '启动容器',
              icon: 'terminal',
              running: false,
              preview: 'docker compose up -d',
              status: '',
              tooltip: '1. docker compose up -d ↵',
            },
          ],
        },
      ],
    },
    editor: {
      type: 'load',
      readOnly: false,
      token: 'preview-token',
      revision: 1,
      groupId: 'g1',
      groupTitle: '构建',
      isEdit: true,
      raw: {
        title: '构建项目',
        steps: steps(['npm ci', 'npm run build']),
        cwd: '${workspaceFolder}',
        terminal: 'new',
        confirm: false,
        description: '编译并打包前端产物',
        icon: 'tools',
        envText: '{\n  "NODE_ENV": "production",\n  "API_BASE": "https://api.example.com"\n}',
      },
      // baseline 与 raw 相差一个字段 → 呈现“未保存”状态
      baseline: {
        title: '构建项目',
        steps: steps(['npm ci', 'npm run build']),
        cwd: '${workspaceFolder}',
        terminal: 'new',
        confirm: false,
        description: '',
        icon: 'tools',
        envText: '{\n  "NODE_ENV": "production",\n  "API_BASE": "https://api.example.com"\n}',
      },
    },
    editorEmpty: { type: 'empty' },
  };

  window.addEventListener('load', () => {
    const payload = FIXTURES[fixture];
    if (!payload) return;
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', { data: payload }));
      // 高级设置现默认展开；?adv=0 可收起，便于核对折叠态。
      if (params.get('adv') === '0') {
        const advanced = document.getElementById('advanced');
        if (advanced) advanced.open = false;
      }
    }, 0);
  });
})();
