"""Add label translations without changing audio or progression data."""
import json
from pathlib import Path
def enrich(root):
 paths=list((root/'lessons/levels').glob('*.json'))
 docs={p:json.loads(p.read_text(encoding='utf-8')) for p in paths}
 # Append stable IDs: existing saves and sentence tokens keep their original cards.
 additions=json.loads((root/'data/ui-vocabulary.json').read_text(encoding='utf-8'))
 for d in docs.values():
  for word in additions.get(d['id'],[]):
   existing=next((w for w in d.get('pairs',[]) if w['id']==word['id']),None)
   if existing is not None:
    existing.update(word)
   else:
    d.setdefault('pairs',[]).append(word)
  assert len(d.get('pairs',[]))<=20, d['id']
 meanings={w['simplified']:w['english'] for d in docs.values() for w in d.get('pairs',[])}
 titles=json.loads((root/'data/set-titles.json').read_text(encoding='utf-8'))
 for p,d in docs.items():
  d.update(titles[d['id']])
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 for name in ['resources','buildings','research']:
  p=root/f'data/{name}.json';data=json.loads(p.read_text(encoding='utf-8'))
  for row in data:row['english']=meanings[row['simplified']]
  p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':enrich(Path(__file__).resolve().parents[1])
