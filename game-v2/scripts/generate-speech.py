"""Generate bundled Mandarin speech. Run with .tools/speech-env/Scripts/python.exe."""
import asyncio, hashlib, json
from pathlib import Path
import edge_tts
ROOT=Path(__file__).resolve().parents[1]
VOICES={'female':'zh-TW-HsiaoChenNeural','male':'zh-TW-YunJheNeural'}
async def main():
 manifest=json.loads((ROOT/'lessons/index.json').read_text(encoding='utf-8'))
 files=[ROOT/'lessons'/file for file in manifest['sets']]
 docs={p:json.loads(p.read_text(encoding='utf-8-sig')) for p in files if p.name!='index.json'}
 tokens={w['id']:w for doc in docs.values() for w in doc.get('pairs',[])}
 catalog={}
 def register(text):
  key=hashlib.sha256(text.encode()).hexdigest()[:16]
  audio={sex:f'audio/{sex}/{key}.mp3' for sex in VOICES}
  catalog[text]=audio
  return audio
 for doc in docs.values():
  doc['audio']=register(doc['traditional'])
  for w in doc.get('pairs',[]):w['audio']=register(w['traditional'])
  for sentence in doc.get('sentences',[]):
   sentence['audio']=register(''.join(tokens[t]['traditional'] for t in sentence['tokens']))
 for text in ['加倍','成長','積累','休息','時間','收穫','豐收','再來']:
  register(text)
 sem=asyncio.Semaphore(4)
 async def generate(text,sex,path):
  dest=ROOT/path;dest.parent.mkdir(parents=True,exist_ok=True)
  if dest.exists() and dest.stat().st_size>1000:return
  async with sem:
   for attempt in range(3):
    try:
     await edge_tts.Communicate(text,VOICES[sex],rate='-10%').save(str(dest))
     print('Saved',path,flush=True);return
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(2*(attempt+1))
 await asyncio.gather(*(generate(text,sex,path) for text,audio in catalog.items() for sex,path in audio.items()))
 for path,doc in docs.items():path.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (ROOT/'audio/catalog.json').write_text(json.dumps({'voices':VOICES,'clips':catalog},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('DONE',len(catalog)*2,'MP3 files',flush=True)
asyncio.run(main())
