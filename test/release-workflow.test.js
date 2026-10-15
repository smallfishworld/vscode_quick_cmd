'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workflow = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/release.yml'),
  'utf8',
);
const script = workflow
  .split('        run: |')
  .at(-1)
  .split('\n')
  .map((line) => line.slice(10))
  .join('\n');
function simulate(id, target = 'a9bc0c492691435170fee1507ae935a348d0d9b7') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-cmd-release-'));
  try {
    fs.writeFileSync(path.join(dir, 'state'), id);
    fs.writeFileSync(
      path.join(dir, 'gh'),
      `#!/bin/bash
set -e
printf '%s\\n' "$*" >> "$FIXTURE_DIR/log"
state="$(cat "$FIXTURE_DIR/state")"
case "$1 $2" in
  'api '*) if [ "$state" = missing ]; then exit 1; fi; echo "$state" ;;
  'release view')
    if [ "$state" = missing ]; then exit 1; fi
    if [[ "$*" = *targetCommitish* ]]; then echo "$OLD_TARGET"; else echo false; fi ;;
  'release delete') echo missing > "$FIXTURE_DIR/state" ;;
  'release create') echo new > "$FIXTURE_DIR/state" ;;
  'release edit') : ;;
  *) exit 2 ;;
esac
`,
      { mode: 0o755 },
    );
    const result = spawnSync('bash', ['-e', '-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: dir + ':' + process.env.PATH,
        FIXTURE_DIR: dir,
        OLD_TARGET: target,
        TAG: 'v0.7.1',
        GITHUB_SHA: 'corrected-commit',
        GITHUB_REPOSITORY: 'smallfishworld/vscode_quick_cmd',
      },
    });
    return {
      status: result.status,
      stderr: result.stderr,
      calls: fs.readFileSync(path.join(dir, 'log'), 'utf8').trim().split('\n'),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
test('same-version replacement deletes only the inspected old release before recreation', () => {
  const r = simulate('413791301');
  assert.equal(r.status, 0, r.stderr);
  const deletion = r.calls.findIndex((line) =>
    line.startsWith('release delete v0.7.1 --yes --cleanup-tag'),
  );
  const creation = r.calls.findIndex((line) =>
    line.startsWith('release create v0.7.1'),
  );
  assert.ok(deletion >= 0 && creation > deletion);
  assert.ok(
    r.calls.some((line) =>
      line.startsWith('release edit v0.7.1 --draft=false'),
    ),
  );
});
test('rerunning preserves a different published release and guards changed old targets', () => {
  const current = simulate('new');
  assert.equal(current.status, 0, current.stderr);
  assert.equal(
    current.calls.some(
      (line) =>
        line.startsWith('release delete') || line.startsWith('release create'),
    ),
    false,
  );
  const changed = simulate('413791301', 'unexpected-target');
  assert.notEqual(changed.status, 0);
  assert.equal(
    changed.calls.some((line) => line.startsWith('release delete')),
    false,
  );
  const absent = simulate('missing');
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(
    absent.calls.some((line) => line.startsWith('release delete')),
    false,
  );
  assert.ok(
    absent.calls.some((line) => line.startsWith('release create v0.7.1')),
  );
});
