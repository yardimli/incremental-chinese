from pathlib import Path
import json,re,html
root=Path(__file__).resolve().parents[1]/'game-v2'
def read(f): return (root/f).read_text('utf-8')
def write(f,s): (root/f).write_text(s,encoding='utf-8')
def save(f,d): write(f,json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def remove(f):
 p=(root/f).resolve(); assert p.is_relative_to(root.resolve()); p.unlink(missing_ok=True)

# Remove templates that belonged exclusively to the removed screens.
sources='\n'.join(p.read_text('utf-8') for p in root.rglob('*.js') if 'tests' not in p.parts)
used=set(re.findall(r"['\"](tpl-[\w-]+)['\"]",sources))
markup=read('index.html')
markup=re.sub(r'\s*<template id="([^"]+)">.*?</template>',lambda m:m[0] if m[1] in used else '',markup,flags=re.S)
write('index.html',markup)
write('ui/interface-text.js',read('ui/interface-text.js').split('export function reasonLabel')[0])
# Keep only message entries referenced by remaining code and templates. Dynamic
# labels also appear as literal keys in options arrays and screen maps.
sources='\n'.join(p.read_text('utf-8') for p in root.rglob('*') if p.suffix in ['.js','.mjs','.html'] and 'tests' not in p.parts)
sources=html.unescape(sources).replace("\\'", "'")
normalized=re.sub(r'\s+', ' ', sources)
for attr in re.findall(r'data-ui(?:-[\w-]+)?="([^"]*)"',sources):
 i=[0]
 def sub(m):
  n=i[0];i[0]+=1;return '{'+str(n)+'}'
 normalized+=' '+re.sub(r'\{\{\d+\}\}',sub,attr)
messages=json.loads(read('data/ui-text.json'))
save('data/ui-text.json',{k:v for k,v in messages.items() if k in normalized})
s=read('tests/interface-text.test.mjs')
s=re.sub(r"test\('nested terms.*?\n\}\);\n",'',s,flags=re.S)
write('tests/interface-text.test.mjs',s)
# The removed auxiliary titles should not remain in the bundled voice catalogue.
manifest=json.loads(read('lessons/index.json'))
required=set()
docs=[json.loads(read('lessons/'+f)) for f in manifest['sets']]
tokens={w['id']:w for d in docs for w in d.get('pairs',[])}
for d in docs:
 required.add(d['traditional'])
 required.update(w['traditional'] for w in d.get('pairs',[]))
 required.update(''.join(tokens[t]['traditional'] for t in q['tokens']) for q in d.get('sentences',[]))
catalog=json.loads(read('audio/catalog.json'))
required.update(['加倍','成長','積累','休息','時間','收穫','豐收','再來'])
clips={k:v for k,v in catalog['clips'].items() if k in required}
kept={path for voices in clips.values() for path in voices.values()}
for voices in catalog['clips'].values():
 for path in voices.values():
  if path not in kept: remove(path)
catalog['clips']=clips
save('audio/catalog.json',catalog)
s=read('scripts/add-translations.py')
s=re.sub(r" for name in \['resources','buildings','research'\]:.*?if __name__",'if __name__',s,flags=re.S)
write('scripts/add-translations.py',s)
# Replace obsolete v1 economy/pause browser scenarios with a v2-specific suite.
for f in ['browser-smoke.cjs','accuracy-browser.cjs','interface-browser.cjs','inactivity-browser.cjs']:
 remove('tests/'+f)
s=read('tests/spa-browser.cjs').replace("      'village',\n",'').replace("      'tech',\n",'').replace("await nav('village')", "await nav('sets')")
write('tests/spa-browser.cjs',s)
write('tests/translations-browser.cjs',read('tests/translations-browser.cjs').replace("['sets', 'village', 'tech']","['sets']"))
# Use a descriptive stylesheet name for the shared collections and memory styles.
# Discard selectors belonging only to the old economy, preserving common styles.
def clean_css(s):
 out='';pos=0
 for m in re.finditer(r'([^{}]+)\{([^{}]*)\}',s):
  prefix=m[1]
  if re.search(r'village|tech|resource|shop-|exchange|path-filter|\.buy\b|\.land-|\.build-|goal-',prefix):
   # Keep mixed selectors for surviving modes.
   parts=[x for x in prefix.split(',') if not re.search(r'village|tech|resource|shop-|exchange|path-filter|\.buy\b|\.land-|\.build-|goal-',x)]
   replacement=','.join(parts)+'{'+m[2]+'}' if parts else ''
  else: replacement=m[0]
  out+=s[pos:m.start()]+replacement;pos=m.end()
 return out+s[pos:]
write('modes.css',clean_css(read('modes.css')))
write('app.css',clean_css(read('app.css')))
print('Cleaned version-specific content and assets')
