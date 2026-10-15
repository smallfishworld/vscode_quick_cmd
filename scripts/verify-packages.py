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
        for resource in ('src/i18n.js', 'src/group-decoration.js', 'media/editor.html', 'media/i18n.js'):
            assert 'extension/' + resource in archive.namelist()
        identities.append((manifest['publisher'], manifest['name']))
    print(f'Verified {artifact.name}: {artifact.stat().st_size} bytes')
assert identities[0] == identities[1], 'Language editions must share extension identity.'
checksums = []
for locale in ('zh-cn', 'en'):
    artifact = root / 'dist' / f'quick-cmd-v{version}-{locale}.vsix'
    checksums.append(hashlib.sha256(artifact.read_bytes()).hexdigest() + '  ' + artifact.name)
(root / 'dist' / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n')
