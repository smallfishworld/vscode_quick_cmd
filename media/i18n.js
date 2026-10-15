(function (root) {
  'use strict';
  let chinese = false;
  const messages = {
    'More actions': '更多操作',
    'Editing in the wide editor.': '正在主编辑区编辑。',
    'Reopen saved version': '重新打开已保存版本',
    'Save changes before reopening?': '重新打开前保存当前修改？',
    'Global commands': '全局命令',
    'New command': '新建命令',
    'Edit command': '编辑命令',
    'Send to terminal': '发送到终端',
    'Select a command to edit': '请选择要编辑的命令',
    'Select a command in the list, or create one below.':
      '在命令列表中选择一条命令，或点击下方按钮新建。',
    'Command name': '命令名称',
    'For example: Build project': '例如：编译项目',
    'Command steps': '命令步骤',
    'Add step': '添加步骤',
    'Step {0}': '步骤 {0}',
    'Step name (optional)': '步骤名称（可选）',
    'Command text': '命令内容',
    'Move up': '上移',
    'Move down': '下移',
    'Delete step': '删除步骤',
    'Drag to reorder': '拖拽排序',
    'Collapse step': '折叠步骤',
    'Expand step': '展开步骤',
    'Send trailing Enter': '发送末尾回车',
    'Trailing Enter will be sent.': '末尾发送回车。',
    'No trailing Enter will be sent.': '末尾不发送回车。',
    'Steps are joined with newlines and sent together. They do not wait for completion or stop on failure. Embedded newlines may execute commands even without a trailing Enter.':
      '各步骤以换行合并发送，不等待完成，也不会在失败后停止。即使不发送末尾回车，内容中的换行仍可能触发执行。',
    'Working directory': '工作目录',
    'Default: current workspace folder': '默认使用当前工作区目录',
    'Terminal usage': '终端使用方式',
    'New terminal each time': '每次新建终端',
    'Prefer an idle dedicated terminal': '优先复用空闲的专用终端',
    'Use the active terminal': '使用当前活动终端',
    'The active terminal uses its existing directory and environment.':
      '使用活动终端时，沿用其现有工作目录和环境变量。',
    'Advanced settings': '高级设置',
    'Confirm before sending to terminal': '发送到终端前确认',
    Description: '命令描述',
    'Optional description': '可选：说明命令用途',
    'Command icon': '命令图标',
    'Environment variables': '环境变量',
    Name: '名称',
    Value: '值',
    'Add variable': '添加环境变量',
    'Remove variable': '删除环境变量',
    'Edit as JSON': '使用 JSON 编辑',
    'Edit as table': '使用表格编辑',
    'Save command': '保存命令',
    'Saving…': '保存中…',
    Saved: '已保存',
    'Unsaved changes': '未保存',
    'Save and send': '保存并发送',
    'Open wide editor': '在主编辑区打开',
    Undo: '撤销',
    'Step deleted.': '已删除步骤。',
    'Maximum 32 steps.': '最多支持 32 个步骤。',
    'Insert variable': '插入变量',
    'Choose a variable': '选择变量',
    'Workspace folder': '工作区目录',
    'Current file': '当前文件',
    'Current file directory': '当前文件目录',
    'File name': '文件名',
    'File name without extension': '不含扩展名的文件名',
    'Relative file path': '文件相对路径',
    'Enter a command name (up to 128 characters).':
      '请输入命令名称，不能超过 128 个字符。',
    'Enter command text for step {0}.': '请输入第 {0} 步的命令内容。',
    'Combined command text cannot exceed 32768 characters.':
      '命令内容总长度不能超过 32768 个字符。',
    'Enter a valid environment variable name and a string value.':
      '请输入有效的环境变量名，变量值必须是字符串且不超过 2048 个字符。',
    'Environment variables must be a JSON object of string values.':
      '环境变量必须是 JSON 对象，且所有值均为字符串。',
    'Invalid environment variable JSON.':
      '环境变量 JSON 格式错误，请检查引号、逗号和括号。',
    'Duplicate environment variable name.': '环境变量名称重复。',
    'Choose a valid command icon.': '请选择有效的命令图标。',
    'Save failed. Your changes have been retained.':
      '保存失败，已保留当前修改。',
    Terminal: '终端',
    Build: '编译构建',
    Start: '启动',
    Test: '测试',
    Deploy: '部署发布',
    Clean: '清理',
    Steps: '多步骤',
    'Custom icon': '自定义图标',
    Running: '运行中',
    Succeeded: '执行成功',
    'Failed · exit code {0}': '执行失败 · 退出码 {0}',
    'Ended · status unknown': '已结束 · 状态未知',
    'Sent · status unknown': '已发送 · 状态未知',
    'Sent without trailing Enter': '已发送，末尾未回车',
    '{0} steps': '{0} 个步骤',
    'Invalid configuration — see tooltip': '配置无效，请查看提示',
    'Drag and drop is supported only within the same configuration scope.':
      '只能在同一配置范围内拖拽；跨范围请使用导入或创建副本。',
    'Moved to {0}.': '已移至“{0}”。',
    'Configuration changed. Undo is no longer available.':
      '配置已发生变化，无法撤销本次移动。',
    'Available in all workspaces': '在所有项目中可用',
    'Stored in .vscode/quick-cmd.json':
      '保存在项目的 .vscode/quick-cmd.json 中',
    'Choose configuration scope': '选择命令保存位置',
    'Group name': '分组名称',
    'Name cannot be blank': '请输入名称',
    'Maximum 128 characters': '名称不能超过 128 个字符',
    'Create new group...': '新建分组…',
    'Choose a command group': '选择命令分组',
    'Input parameter: {0}': '输入参数：{0}',
    'Send "{0}"?\n{1}': '将“{0}”发送到终端？\n{1}',
    'The active terminal may be busy. Sending text could interfere with an interactive program.':
      '当前活动终端可能正忙，发送内容可能干扰正在运行的交互式程序。',
    'Send Anyway': '仍然发送',
    'Run Command': '发送到终端',
    '{0} (copy)': '{0}（副本）',
    'Delete command "{0}"?': '删除命令“{0}”？',
    Delete: '删除',
    'Rename group': '重命名分组',
    'Delete group "{0}" and {1} command(s)?':
      '删除分组“{0}”及其中的 {1} 条命令？',
    'Use Export to save global configuration as JSON.':
      '请使用“导出配置”将全局命令保存为 JSON 文件。',
    'Quick Cmd configuration exported.': '已导出命令配置。',
    'No Quick Cmd commands configured yet.': '还没有命令，请先新建命令。',
    'Search commands, then choose an action': '搜索命令，然后选择查看或发送',
    'Keybinding JSON copied. Paste it into keybindings.json and customize the key.':
      '已复制快捷键配置，请粘贴到 keybindings.json 并设置按键。',
    'This command does not have a running tracked terminal.':
      '该命令没有可停止的专用运行终端。',
    'Close the dedicated terminal to stop the running command?':
      '关闭专用终端以停止运行中的命令？',
    'Stop Command': '停止命令',
    'Export Quick Cmd configuration': '导出命令配置',
    'Import Quick Cmd configuration': '导入命令配置',
    'Replace all commands in "{0}" with {1} imported group(s)?':
      '用导入的 {1} 个分组替换“{0}”中的全部命令？',
    'Replace Commands': '替换命令',
    Save: '保存',
    Discard: '放弃修改',
    Cancel: '取消',
    'Save changes to "{0}" before switching?': '切换前保存对“{0}”的修改？',
    'Command changed outside this editor. Reopen it to review the latest version; your draft is retained.':
      '命令已在其他位置修改，请重新打开并检查最新内容。当前草稿已保留。',
    'The selected workspace is no longer open.': '所选工作区已关闭。',
    'The workspace is no longer open.': '工作区已关闭。',
    'Choose a command first.': '请先选择命令。',
    'Command group changed. Reopen the editor.':
      '命令分组已变化，请重新打开编辑器。',
    'Invalid command fields.': '命令字段无效。',
    'Stale editor request. Please retry.': '编辑状态已变化，请重试。',
    'Global commands are edited from the sidebar, not JSON.':
      '请在侧栏编辑全局命令，或导出为 JSON 文件。',
    'Cannot read {0}/.vscode/quick-cmd.json: {1}':
      '无法读取 {0}/.vscode/quick-cmd.json：{1}',
    'This command needs an open workspace for ${workspaceFolder}.':
      '该命令使用 ${workspaceFolder}，请先打开工作区。',
    'Relative working directories require an open workspace.':
      '使用相对工作目录前，请先打开工作区。',
    'Trust this workspace before running saved shell commands.':
      '发送命令前，请先信任该工作区。',
    'Commands require a file-system workspace.':
      '命令需要本地或远程主机上的实际文件目录。',
    'Invalid terminal steps.': '终端命令步骤无效。',
    'The active terminal cannot apply command-specific cwd or env. Use new or reuse mode.':
      '活动终端不能应用自定义工作目录或环境变量，请选择新建或复用专用终端。',
    'No dedicated terminal is available for this command.':
      '该命令没有可用的专用终端。',
    'This value contains characters unsafe for cmd.exe interpolation. Use PowerShell instead.':
      '参数包含无法安全用于 cmd.exe 插值的字符，请改用 PowerShell。',
    'Invalid input name: {0}': '输入参数名称无效：{0}',
    'Open a saved file to use ${file} variables.':
      '使用 ${file} 等文件变量前，请先打开已保存的文件。',
    '${workspaceFolder} needs an open workspace.':
      '使用 ${workspaceFolder} 前，请先打开工作区。',
    'Environment variable {0} is not set.': '环境变量 {0} 未设置。',
    'Input {0} is missing.': '缺少输入参数 {0}。',
    'Unknown variable: {0}': '未知变量：{0}',
    'Command no longer exists.': '命令已不存在。',
    'Group no longer exists. Refresh the view.': '分组已不存在，请刷新列表。',
    'Command no longer exists. Refresh the view.': '命令已不存在，请刷新列表。',
    'Item no longer exists.': '条目已不存在。',
    'Invalid drop target.': '拖拽目标无效。',
    'Drop a group onto another group or its scope.':
      '请将分组拖到其他分组或其所属范围。',
    'Group no longer exists.': '分组已不存在。',
    'Target group no longer exists.': '目标分组已不存在。',
    'Drop a command onto a command or group.': '请将命令拖到其他命令或分组。',
    'Target command no longer exists.': '目标命令已不存在。',
    'Group limit reached.': '分组数量已达上限。',
    'Command limit reached.': '命令数量已达上限。',
    'Invalid Quick Cmd config: expected { "version": 1, "groups": [] }.':
      '配置格式无效，应包含 version: 1 和 groups 数组。',
    'Too many groups (limit: {0}).': '分组过多，最多支持 {0} 个。',
    'Too many commands (limit: {0}).': '命令过多，最多支持 {0} 条。',
    'Each group must contain a commands array.':
      '每个分组必须包含 commands 数组。',
    'Each command must be an object.': '每条命令必须是对象。',
    'Duplicate id: {0}': '标识重复：{0}',
    'Use either command or steps, not both.':
      'command 和 steps 字段不能同时使用。',
    'Command steps must contain 1 to {0} entries.':
      '命令必须包含 1 至 {0} 个步骤。',
    'Each step must be an object.': '每个步骤必须是对象。',
    'Step title must be a string of at most 64 characters.':
      '步骤名称必须是字符串，且不能超过 64 个字符。',
    'Step execute must be a boolean.': '步骤的 execute 字段必须是布尔值。',
    'Only the final step can disable newline execution, to avoid accidental execution of combined input.':
      '只有最后一步可以取消发送回车。',
    'Combined command text is too long (32768 characters maximum).':
      '命令内容总长度不能超过 32768 个字符。',
    'Command execute must be a boolean.': '命令的 execute 字段必须是布尔值。',
    'Command terminal must be new, reuse, or active.':
      'terminal 字段必须为 new、reuse 或 active。',
    'Command confirm must be a boolean.': 'confirm 字段必须是布尔值。',
    'Command env must map valid environment variable names to strings of at most 2048 characters.':
      '环境变量名称必须有效，值必须是字符串且不超过 2048 个字符。',
    '{0} must be a non-empty string of at most {1} characters.':
      '{0}不能为空，且不能超过 {1} 个字符。',
    'Command {0} must be a string of at most {1} characters.':
      '命令的 {0} 字段必须是字符串，且不能超过 {1} 个字符。',
    'Command id': '命令标识',
    'Command title': '命令名称',
    'Shell step': '步骤命令',
    'Shell command': '终端命令',
    'Group id': '分组标识',
    'Group title': '分组名称',
    'Provide a command id; see the Quick Cmd shortcut documentation.':
      '请提供命令标识，具体用法参见快捷键说明。',
    'Command id not found: {0}': '找不到命令标识：{0}',
    'Ambiguous command id: {0}. Specify a scope id.':
      '命令标识 {0} 存在于多个范围，请指定范围标识。',
    'Unable to complete this operation. Check the configuration and try again.':
      '无法完成操作，请检查配置后重试。',
  };
  function setLocale(locale) {
    chinese = /^zh\b/i.test(locale || 'en');
  }
  function t(key, ...values) {
    return (chinese ? messages[key] || key : key).replace(
      /\{(\d+)\}/g,
      (_, i) => String(values[+i] ?? ''),
    );
  }
  function errorText(error) {
    const message = String(error?.message || error);
    if (!chinese) return message;
    if (Object.hasOwn(messages, message)) return t(message);
    for (const key of Object.keys(messages)) {
      if (!/\{\d+\}/.test(key)) continue;
      const indexes = [];
      const pattern = key
        .split(/(\{\d+\})/)
        .map((part) => {
          if (/^\{\d+\}$/.test(part)) {
            indexes.push(+part.slice(1, -1));
            return '([\\s\\S]*?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      const match = message.match(new RegExp('^' + pattern + '$'));
      if (match) {
        const args = [];
        indexes.forEach((n, i) => {
          args[n] = Object.hasOwn(messages, match[i + 1])
            ? t(match[i + 1])
            : match[i + 1];
        });
        if (key === 'Cannot read {0}/.vscode/quick-cmd.json: {1}')
          args[1] = errorText(args[1]);
        return t(key, ...args);
      }
    }
    if (/[\u3400-\u9fff]/.test(message)) return message;
    return t(
      'Unable to complete this operation. Check the configuration and try again.',
    );
  }
  const api = { setLocale, t, errorText, messages };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuickCmdI18n = api;
})(globalThis);
