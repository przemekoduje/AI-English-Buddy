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
import re
import time

DIST_DIR = os.path.join(os.path.dirname(__file__), '..', 'dist')

OLD_VIEWPORT = 'width=device-width, initial-scale=1, shrink-to-fit=no'
NEW_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no'

# JS injected right before </head> — blocks pinch-zoom on iOS Safari AND redirects desktop resize to desktop version
PINCH_ZOOM_BLOCKER = '''<script>
// Disable pinch-zoom on iOS Safari (ignores user-scalable=no since iOS 10)
document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', function(e) {
  if (e.touches.length > 1) { e.preventDefault(); }
}, { passive: false });

// Dynamic redirect back to desktop version when resizing above mobile width on desktop browser
(function() {
  var isRedirecting = false;
  function checkDesktopRedirect() {
    if (isRedirecting) return;
    try {
      var isRealMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                         (window.screen && Math.min(window.screen.width, window.screen.height) < 768);
      
      if (!isRealMobile && window.innerWidth >= 768) {
        var path = window.location.pathname;
        if (path.startsWith('/speakling/mobile') || path.startsWith('/mobile')) {
          isRedirecting = true;
          var searchParams = new URLSearchParams(window.location.search);
          searchParams.delete('cb');
          var query = searchParams.toString();
          var queryStr = query ? ('?' + query) : '';
          var target = window.location.origin + '/speakling' + queryStr + window.location.hash;
          window.location.replace(target);
        }
      }
    } catch (e) {
      console.error('Desktop redirect check failed:', e);
    }
  }

  checkDesktopRedirect();
  window.addEventListener('resize', checkDesktopRedirect);
})();
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

    # 2. Inject JS blocker & desktop redirect before </head>
    if '// Disable pinch-zoom on iOS Safari' in content:
        content = re.sub(r'<script>\s*// Disable pinch-zoom on iOS Safari.*?</script>', PINCH_ZOOM_BLOCKER, content, flags=re.DOTALL)
        changed = True
    elif PINCH_ZOOM_BLOCKER.strip() not in content and '</head>' in content:
        content = content.replace('</head>', PINCH_ZOOM_BLOCKER + '</head>', 1)
        changed = True

    # 3. Cache-bust JS entry bundles
    timestamp = int(time.time())
    if '_expo/static/js/web' in content:
        new_content = re.sub(r'(_expo/static/js/web/[^"]+\.js)(?:\?v=\d+)?', r'\1?v=' + str(timestamp), content)
        if new_content != content:
            content = new_content
            changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'[OK] Patched: {os.path.basename(path)}')
        patched += 1
    else:
        print(f'- Skipped (already OK): {os.path.basename(path)}')

print(f'\nDone. Patched {patched}/{len(html_files)} files.')
