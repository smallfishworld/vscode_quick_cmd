"""Verify the single multilingual VSIX and write one matching SHA-256 entry."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
artifact = root / 'dist' / f'quick-cmd-v{version}.vsix'
assert artifact.exists(), f'Missing installer: {artifact.name}'
other_vsix = sorted(p.name for p in (root / 'dist').glob('*.vsix') if p != artifact)
assert not other_vsix, f'Unexpected extra VSIX files: {other_vsix}'

with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None, f'Corrupt ZIP: {artifact}'
    contents = set(archive.namelist())
    manifest = json.loads(archive.read('extension/package.json'))
    english = json.loads(archive.read('extension/package.nls.json'))
    chinese = json.loads(archive.read('extension/package.nls.zh-cn.json'))
    source_manifest = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    assert manifest['version'] == version
    assert (manifest['publisher'], manifest['name']) == (source_manifest['publisher'], source_manifest['name'])
    assert 'quickCmdBuildLanguage' not in manifest, 'The installer must not pin a language.'
    assert english['quickCmd.commands'] == 'Groups'
    assert chinese['quickCmd.commands'] == '分组'
    assert set(english) == set(chinese), 'Missing translated manifest keys.'
    assert 'extension/presets/defaults.zh-CN.json' in contents
    assert 'extension/presets/defaults.en.json' in contents
    assert not any('/node_modules/' in name for name in contents)
    for resource in (
        'src/i18n.js', 'src/list.js', 'media/list.html', 'media/list-client.js',
        'media/codicons/codicon.css', 'media/codicons/codicon.ttf',
        'media/editor.html', 'media/i18n.js', 'README.md', 'README.zh-CN.md',
    ):
        assert 'extension/' + resource in contents
    # Every runtime file must match the checkout (codicons are generated from npm).
    for folder in ('src', 'media', 'presets'):
        expected = {
            f'extension/{p.relative_to(root).as_posix()}'
            for p in (root / folder).rglob('*') if p.is_file()
        }
        actual = {
            name for name in contents
            if name.startswith('extension/' + folder + '/') and not name.endswith('/')
        }
        if folder == 'media':
            actual = {name for name in actual if not name.startswith('extension/media/codicons/')}
        assert actual == expected, f'Unexpected or missing runtime files in {artifact.name}: {actual ^ expected}'
        for name in expected:
            assert archive.read(name) == (root / name.removeprefix('extension/')).read_bytes(), f'Stale runtime file: {name}'

print(f'Verified {artifact.name}: {artifact.stat().st_size} bytes')
checksum = hashlib.sha256(artifact.read_bytes()).hexdigest()
(root / 'dist' / 'SHA256SUMS').write_text(
    f'{checksum}  {artifact.name}\n', encoding='utf-8',
)
