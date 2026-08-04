#!/usr/bin/env python3
"""
Patch viewport meta tag in all Expo Web exported HTML files
to disable pinch-zoom and ensure full-viewport layout.

Run after: npx expo export --platform web
"""
import os
import glob

DIST_DIR = os.path.join(os.path.dirname(__file__), '..', 'dist')

OLD_VIEWPORT = 'width=device-width, initial-scale=1, shrink-to-fit=no'
NEW_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no'

html_files = glob.glob(os.path.join(DIST_DIR, '**', '*.html'), recursive=True)
html_files += glob.glob(os.path.join(DIST_DIR, '*.html'))

patched = 0
for path in set(html_files):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if OLD_VIEWPORT in content:
        content = content.replace(OLD_VIEWPORT, NEW_VIEWPORT)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✓ Patched: {os.path.basename(path)}')
        patched += 1
    else:
        print(f'- Skipped (already OK or different): {os.path.basename(path)}')

print(f'\nDone. Patched {patched}/{len(set(html_files))} files.')
