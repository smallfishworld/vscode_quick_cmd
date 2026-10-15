"""Check both release ZIPs before any existing release is removed (stdlib only)."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
identities = []
for locale in ('zh-cn', 'en'):
    artifact = root / 'dist' / f'quick-cmd-v{version}-{locale}.vsix'
    with zipfile.ZipFile(artifact) as archive:
        assert archive.testzip() is None, f'Corrupt ZIP: {artifact}'
        manifest = json.loads(archive.read('extension/package.json'))
        catalog = json.loads(archive.read('extension/package.nls.json'))
        assert manifest['version'] == version
        assert manifest['quickCmdBuildLanguage'] == locale
        assert catalog['quickCmd.commands'] == ('分组' if locale == 'zh-cn' else 'Groups')
        assert 'extension/package.nls.zh-cn.json' not in archive.namelist()
        assert not any('/node_modules/' in name for name in archive.namelist())
        for resource in ('src/i18n.js', 'src/list.js', 'media/list.html', 'media/list-client.js', 'media/codicons/codicon.css', 'media/codicons/codicon.ttf', 'media/editor.html', 'media/i18n.js'):
            assert 'extension/' + resource in archive.namelist()
        # Every runtime file must match this checkout; reject stale staging files.
        for folder in ('src', 'media'):
            expected = {f'extension/{p.relative_to(root).as_posix()}' for p in (root / folder).rglob('*') if p.is_file()}
            actual = {name for name in archive.namelist() if name.startswith('extension/' + folder + '/') and not name.endswith('/')}
            if folder == 'media':
                actual = {name for name in actual if not name.startswith('extension/media/codicons/')}
            assert actual == expected, f'Unexpected or missing runtime files in {artifact.name}: {actual ^ expected}'
            for name in expected:
                assert archive.read(name) == (root / name.removeprefix('extension/')).read_bytes(), f'Stale runtime file: {name}'
        identities.append((manifest['publisher'], manifest['name']))
    print(f'Verified {artifact.name}: {artifact.stat().st_size} bytes')
assert identities[0] == identities[1], 'Language editions must share extension identity.'
checksums = []
for locale in ('zh-cn', 'en'):
    artifact = root / 'dist' / f'quick-cmd-v{version}-{locale}.vsix'
    checksums.append(hashlib.sha256(artifact.read_bytes()).hexdigest() + '  ' + artifact.name)
(root / 'dist' / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')
