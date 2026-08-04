#!/usr/bin/env python3
"""
Patch viewport meta tag AND inject JS pinch-zoom blocker in all
Expo Web exported HTML files.

iOS Safari 10+ ignores user-scalable=no in the viewport meta,
so we also need a JavaScript gesture blocker.

Run after: npx expo export --platform web
"""
import os
import glob

DIST_DIR = os.path.join(os.path.dirname(__file__), '..', 'dist')

OLD_VIEWPORT = 'width=device-width, initial-scale=1, shrink-to-fit=no'
NEW_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no'

# JS injected right before </head> — blocks pinch-zoom on iOS Safari
PINCH_ZOOM_BLOCKER = '''<script>
// Disable pinch-zoom on iOS Safari (ignores user-scalable=no since iOS 10)
document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) { e.preventDefault(); }
}, { passive: false });
</script>'''

html_files = list(set(
    glob.glob(os.path.join(DIST_DIR, '**', '*.html'), recursive=True) +
    glob.glob(os.path.join(DIST_DIR, '*.html'))
))

patched = 0
for path in html_files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. Fix viewport meta
    if OLD_VIEWPORT in content:
        content = content.replace(OLD_VIEWPORT, NEW_VIEWPORT)
        changed = True

    # 2. Inject JS blocker before </head> (only once)
    if PINCH_ZOOM_BLOCKER.strip() not in content and '</head>' in content:
        content = content.replace('</head>', PINCH_ZOOM_BLOCKER + '</head>', 1)
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'✓ Patched: {os.path.basename(path)}')
        patched += 1
    else:
        print(f'- Skipped (already OK): {os.path.basename(path)}')

print(f'\nDone. Patched {patched}/{len(html_files)} files.')
