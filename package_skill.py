#!/usr/bin/env python3
"""Allowlisted portable bundle; maintainer tests/evidence never enter the ZIP."""
from pathlib import Path
import hashlib
import re
import zipfile

root=Path(__file__).resolve().parent
version='0.2.2'
files=sorted((root/'create-pet-game').rglob('*'))
files=[p for p in files if p.is_file()]
files += [root/'INSTALL.md',root/'install.mjs',root/'examples/pet-tictactoe.html',root/'examples/pet-strike.html']
for p in files:
    if p.is_symlink() or any(part in {'node_modules','__pycache__','.git'} for part in p.relative_to(root).parts):
        raise SystemExit(f'Forbidden package entry: {p.name}')
    data=p.read_text(encoding='utf-8')
    # Avoid leaking producer paths, credentials or private host source imports.
    patterns=[r'/Users/[^/\s]+/',r'/private/var/folders/',r'\bsk-[A-Za-z0-9_-]{16,}',r'(?i)Bearer\s+[A-Za-z0-9._-]{20,}',r'desktop-pet-game-skill',r'BEGIN (?:RSA |EC )?PRIVATE KEY']
    if any(re.search(pattern,data) for pattern in patterns):
        raise SystemExit(f'Nonportable or credential-like content: {p.name}')
out=root/'dist';out.mkdir(exist_ok=True)
archive=out/f'create-pet-game-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    for p in sorted(files):
        info=zipfile.ZipInfo(p.relative_to(root).as_posix(),date_time=(2026,10,14,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o100644<<16
        bundle.writestr(info,p.read_bytes())
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {archive.stat().st_size} bytes; {len(files)} files; SHA-256 {digest}')
