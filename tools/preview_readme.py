"""A local preview of the README as GitHub shows it (its column and page, dark or light), so the media
can be judged before pushing.

    python tools/preview_readme.py   ->  tools/preview-readme.html   (open it through the dev server:
                                         http://localhost:5211/tools/preview-readme.html?tema=light)
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md = open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read()
html = md.replace('src="media/', 'src="../media/').replace('srcset="media/', 'srcset="../media/')
# The few lines of Markdown in the details: enough for a preview.
html = re.sub(r'^- (.*)$', r'<li>\1</li>', html, flags=re.M)
html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
page = f'''<!doctype html>
<html><head><meta charset="utf-8"><title>README · preview</title>
<style>
  body {{ margin: 0; font: 16px/1.5 -apple-system, "Segoe UI", sans-serif; }}
  body.dark {{ background: #0d1117; color: #e6edf3; color-scheme: dark; }}
  body.light {{ background: #ffffff; color: #1f2328; color-scheme: light; }}
  main {{ max-width: 830px; margin: 32px auto; padding: 0 16px; }}
  p {{ margin: 0 0 16px; }}
  img {{ max-width: 100%; }}
  code {{ font-size: 85%; padding: .2em .4em; border-radius: 6px; background: rgba(127,127,127,.15); }}
</style></head>
<body><main>{html}</main>
<script>
  const t = new URLSearchParams(location.search).get('tema') ?? 'dark';
  document.body.className = t;
  // (the page's scheme decides which <source media=...> GitHub picks; force it here)
  for (const s of document.querySelectorAll('source[media]')) if (t === 'light') s.remove(); else s.removeAttribute('media');
</script></body></html>'''
open(os.path.join(ROOT, 'tools', 'preview-readme.html'), 'w', encoding='utf-8').write(page)
print('tools/preview-readme.html')
