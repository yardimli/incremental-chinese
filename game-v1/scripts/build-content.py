"""Compile the reviewed design into small runtime files. Does not edit concept-v4."""
import json, re
from pathlib import Path
from opencc import OpenCC
from pypinyin import lazy_pinyin, Style
ROOT=Path(__file__).resolve().parents[1]
D=json.loads((ROOT.parent/'docs/hsk-mapping/mapping.json').read_text(encoding='utf-8'))
cc=OpenCC('s2t')
def write(path,data):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def card(text,english,id):
 return dict(id=id,simplified=text,traditional=cc.convert(text),pinyin=' '.join(lazy_pinyin(text,style=Style.TONE)),english=english)
levels=[]; allwords={}; seq=[]
extras={2:[('十一','eleven'),('十二','twelve'),('十五','fifteen'),('二十','twenty'),('二十一','twenty-one'),('三十','thirty'),('五十','fifty'),('九十九','ninety-nine')],3:[('万','ten thousand'),('亿','hundred million'),('兆','trillion')],5:[('这儿','here'),('那儿','there'),('哪儿','where')],10:[('天','day')],12:[('说','speak')],15:[('第','ordinal prefix')],21:[('跑','run')]}
numbers=dict(zip(['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十五','二十','二十一','三十','五十','九十九','百','千','万','亿','兆'],[0,1,2,3,4,5,6,7,8,9,10,11,12,15,20,21,30,50,99,100,1000,10000,100000000,1000000000000]))
for level in D['levels']:
 n=level['level']
 if n>25:continue
 entries=[(re.split('[（(]',v['Chinese'])[0],v['English']) for v in D['vocabulary'] if v['Game level']==n]+extras.get(n,[])
 pairs=[]
 for i,(cn,en) in enumerate(entries):
  w=card(cn,en,f'L{n:02}-{i:02}')
  if cn in numbers:w['number']=numbers[cn]
  pairs.append(w);allwords[cn]=w
 doc=dict(id=f'L{n:02}',level=n,type='pairs',title=level['title'],traditional=f'第{n}冊',simplified=f'第{n}册',pinyin=f'dì {n} cè',pairs=pairs)
 assert len(pairs)<=20
 file=f'levels/level-{n:02}.json';write('lessons/'+file,doc);seq.append(file)
 if n in (1,8):
  resource_words=[('木材','timber'),('石料','stone'),('知识','knowledge')] if n==1 else [('砖','bricks'),('心得','insight')]
  resource_pairs=[card(cn,en,f'V{n:02}-{i}') for i,(cn,en) in enumerate(resource_words)]
  file=f'levels/resources-{n:02}.json';write('lessons/'+file,dict(id=f'V{n:02}',level=n,type='pairs',auxiliary=True,traditional='資源',simplified='资源',pinyin='zī yuán',pairs=resource_pairs));seq.append(file)
 if n%3==0:
  sentences=[]
  def sentence(parts,en):
   if all(p in allwords for p in parts):sentences.append(dict(id=f'S{n:02}-{len(sentences)+1}',tokens=[allwords[p]['id'] for p in parts],english=en))
  if n==3:
   for digit,en in [('一','one'),('二','two'),('三','three'),('四','four'),('五','five'),('六','six')]:
    for unit,meaning in [('百','hundred'),('千','thousand'),('万','ten thousand'),('元','yuan'),('块','yuan (colloquial)')]:sentence([digit,unit],f'{en} {meaning}')
  else:
   for subject,en in [('我','I'),('你','You'),('他','He'),('她','She'),('我们','We')]:
    for verb,meaning in [('喝','drink'),('要','want'),('想','want')]:
     for obj,english in [('水','water'),('茶','tea')]:
      conjugated=meaning+('s' if en in ['He','She'] else '')
      sentence([subject,verb,obj] if verb!='想' else [subject,verb,'喝',obj],f'{en} {conjugated} {english}.' if verb!='想' else f'{en} would like to drink {english}.')
   # Add authored grammar examples that are composed of taught cards.
   for g in D['grammar']:
    if g['After level']<=n:
     parts=[x.strip() for x in g['Chinese example'].split('/')]
     if 2<=len(parts)<=4:sentence(parts,g['English'])
  file=f'levels/sentences-{n:02}.json'
  write('lessons/'+file,dict(id=f'S{n:02}',level=n,type='sentences',traditional='組句',simplified='组句',pinyin='zǔ jù',countPerRun=10,sentences=sentences))
  seq.append(file)
write('lessons/index.json',{'sets':seq})
eco=D['village_economy']
resources=[dict(id=id,traditional=cc.convert(cn),simplified=cn,pinyin=py,cap=cap,level=lv,exchange=rate) for id,cn,py,cap,lv,rate in [('timber','木材','mù cái',200,1,3),('stone','石料','shí liào',200,1,5),('bricks','砖','zhuān',100,8,16),('knowledge','知识','zhī shi',100,1,None),('insight','心得','xīn dé',50,8,None)]]
write('data/resources.json',resources)
names=[('木材','mù cái'),('石料','shí liào'),('学习','xué xí'),('家','jiā'),('砖','zhuān'),('心得','xīn dé')]
buildings=[]
for i,b in enumerate(eco['infrastructure']):
 cn,py=names[i];outputs=[{'timber':12},{'stone':8},{'knowledge':3},{},{'bricks':2},{'insight':1}][i]
 buildings.append(dict(id=b['ID'],level=[1,1,1,2,8,8][i],traditional=cc.convert(cn),simplified=cn,pinyin=py,path='Infrastructure',cost={'coins':b['First-copy coins'],'timber':b['Timber'],'stone':b['Stone'],'bricks':0},output=outputs,sentence=i==5,storage=i==3))
for p in eco['projects']:
 if p['Level']>25:continue
 buildings.append(dict(id=p['ID'],level=p['Level'],traditional=cc.convert(p['Chinese label']),simplified=p['Chinese label'],pinyin=p['Pinyin'],path=p['Path'],cost={'coins':p['Build price (coins)'],'timber':p['Timber'],'stone':p['Stone'],'bricks':p['Bricks']},research=p['Research ID'],scope=p['Scope'],contribution=p['Contribution per copy'],output={'knowledge':p['Knowledge/min per copy'],'insight':p['Insight/min per copy'],'coins':p['Coins/min per copy']},sentence=p['Path']=='Study'))
write('data/buildings.json',buildings)
research=[]
for r in eco['research']:
 if r['Level']>25:continue
 b=next(b for b in buildings if b.get('research')==r['ID'])
 research.append(dict(id=r['ID'],level=r['Level'],previous=r['Previous research ID'] or None,traditional=b['traditional'],simplified=b['simplified'],pinyin=b['pinyin'],path=r['Path'],building=b['id'],cost={'knowledge':r['Knowledge'],'insight':r['Insight']}))
write('data/research.json',research)
write('data/progression.json',dict(version=3,baseCoins=10,growth=1.6,copyGrowth=1.18,copyDiminish=.7,offlineHours=8,baseLand=4,maxLevel=25,settlementGrant=250,memoryPairs=6,memoryPairWeight=2,memoryBoardWeight=5,prestigeGain=.5,gates=[dict(level=n,buildings=2+n//2,research=1+n//3,resources=dict(timber=10*n,stone=5*n,knowledge=2+2*n,**(dict(bricks=4*(n-7),insight=n-7) if n>=8 else {}))) for n in range(1,26)]))
print('Wrote',len(seq),'language stages,',len(buildings),'buildings and',len(research),'technologies.')

# Keep UI translations in generated data, including after a content rebuild.
import runpy
runpy.run_path(str(ROOT/'scripts/add-translations.py'))['enrich'](ROOT)
