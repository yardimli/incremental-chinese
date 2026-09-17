from pathlib import Path
import csv, json, html, hashlib, collections

ROOT=Path(__file__).parent
source1=list(csv.DictReader((ROOT/'sources/hsk_1.csv').open(encoding='utf-8-sig')))
source2=list(csv.DictReader((ROOT/'sources/hsk_2.csv').open(encoding='utf-8-sig')))
one={r['character'] for r in source1}
ref={r['character']:r for r in source2}
levels=[]; vocabulary=[]; lookup={}
for line in (ROOT/'levels.txt').read_text(encoding='utf-8').splitlines():
    n,title,village,items=line.split('|'); n=int(n)
    entries=[p.split('=',1) for p in items.split(';')]
    levels.append({'level':n,'title':title,'village':village,'new_entries':len(entries)})
    for word,meaning in entries:
        assert word in ref and word not in lookup,word
        lookup[word]=n
        vocabulary.append({'Chinese':word,'Pinyin':ref[word]['pinyin'],'English':meaning,'HSK':1 if word in one else 2,'Game level':n,'Village use':village,'Practice':'Context/order + matching' if word in '的 吗 呢 吧 了 得 着 过 因为 所以 但是 就 比 从 向 离 让'.split() else 'Target/weapon + matching; reuse in sentences'})
assert set(lookup)==set(ref) and len(vocabulary)==300 and len(one)==150
assert collections.Counter(r['HSK'] for r in vocabulary)=={1:150,2:150}

extensions=[
 (2,'十一、十二、十五、二十、二十一、三十、五十、九十九','11, 12, 15, 20, 21, 30, 50, 99','8 compositional practice cards; not 8 HSK headwords',8),
 (3,'万、亿、兆','ten thousand; hundred million; trillion (game convention)','3 game economy additions',3),
 (5,'这儿、那儿、哪儿','here; there; where','3 separately practised variants already grouped in source entries',3),
 (10,'天','day','1 separately taught component for 每天',1),
 (12,'说','say / speak','1 component/edition bridge from 说话',1),
 (15,'第','ordinal prefix','1 component of 第一; do not assume it is already mastered',1),
 (21,'跑','run','1 component of 跑步 used with 得',1),
 (26,'饭店、没有、一点儿、男、女、往、日、零','restaurant/hotel; not have; a little; male; female; toward; day; zero','Optional edition bridge A: 6 new forms, 2 review entries',6),
 (27,'宾馆、面条、铅笔、虽然、一下、回答','hotel; noodles; pencil; although; briefly; answer','Optional edition bridge B: 5 new forms, 1 review entry',5),
 (27,'有点儿','a little (usually an undesirable condition)','1 optional grammar extension',1)
]
for level in levels:
    level['card_count']=level['new_entries']+sum(x[4] for x in extensions if x[0]==level['level'])
assert all(x['card_count']<=20 for x in levels)
aliases={'这':5,'这儿':5,'那':5,'那儿':5,'哪':5,'哪儿':5,'天':10,'说':12,'第':15,'跑':21,'一点儿':26,'有点儿':27,'虽然':27}
token_levels={**lookup,**aliases}
keys=sorted(token_levels,key=len,reverse=True)
def prerequisites(text):
    text=text.replace(' / ',''); at=0; found=[]
    while at<len(text):
        match=next((k for k in keys if text.startswith(k,at)),None)
        assert match,('Unintroduced example token',text[at:])
        found.append(token_levels[match]);at+=len(match)
    return max(found)
grammar=[];by_level=collections.Counter()
for line in (ROOT/'grammar.txt').read_text(encoding='utf-8').splitlines():
    gid,band,pattern,example,meaning,use=line.split('|')
    level=prerequisites(example)
    # Do not teach a pattern before its operator is introduced, even if omitted in the example.
    if gid=='G24': level=max(level,8)
    if gid=='G76': level=max(level,24)
    by_level[level]+=1
    stage=f'S{level:02d}.{(by_level[level]+1)//2}'
    grammar.append({'ID':gid,'Teaching band':band,'Pattern':pattern,'After level':level,'Sentence stage':stage,'Chinese example':example,'English':meaning,'Game/village interaction':use})

sources=[
 ('Pinned vocabulary transcription (CC0)','https://github.com/sawcordwell/HSK-Vocab'),
 ('Classic official vocabulary PDF; earlier edition','https://www.chinesetest.cn/userfiles/file/cihui.pdf'),
 ('Official classic HSK handbook: level scope','https://www.chinesetest.cn/userfiles/file/HSKTest.pdf'),
 ('Standard Course grammar chart: secondary cross-check','https://www.chinesezerotohero.com/wp-content/uploads/2018/06/HSK-1-2-Standard-Course-Grammar-Chart.pdf'),
 ('Alternate classic HSK 1 listing','https://hsk.academy/en/hsk-1-vocabulary-list'),
 ('Alternate classic HSK 2 listing','https://hsk.academy/en/hsk-2-vocabulary-list')
]
intro='''This is a design mapping, not a change to the playable game. Scope: the pinned classic HSK 1–2 list (150 HSK 1 entries + 150 additional HSK 2 entries), not HSK 3.0. HSK 2 is cumulative: there are 300 entries total, not 450. Game order intentionally mixes HSK levels.

The earlier outline mixed classic editions. This audited baseline uses 饭馆, 没, 说话, 男人, 女人 and 向; 回答 is HSK 2 here, not an extra. It also restores missing items such as 船, 公斤, 欢迎, 元, 张 and 自行车. Alternate forms and edition additions appear separately. Grouped source entries such as 哪（哪儿） count once in the source but their separately introduced cards count against the game's 20-card limit.

Grammar has no single universally agreed count across teaching resources. The 76 rows below are our explicit teaching checklist, not a claim that the official exam publishes exactly 76 rules. “Foundation” and “Expansion” are teaching bands, not certified exam classifications. Examples and village assignments are newly authored. Optional edition-bridge patterns are labelled. Examples show one useful meaning at a time, not every dictionary sense.

Village replaces Boosts. Coins come primarily from correct gameplay; buildings multiply word, matching, sentence, or set-award payouts. No extra currencies or material-production economy. Each vocabulary entry maps to its first introduction; its village role is thematic context, not an individual building to construct. Building titles beyond taught vocabulary use contextual art and are introduced separately before becoming puzzle requirements.
'''
rules='''Every word level has at most 20 newly introduced cards, counting number examples and component forms. Sentence stages are separate: at most two new patterns and 10 sentence cards per stage, drawn from a planned 30-sentence pool. The table gives a representative example per pattern; it does not yet author those full pools. Insert each S-stage after its listed prerequisite level; do not wait until the end to practise grammar.

Normal order puzzles use 2–4 target cards with 8–10 choices. A card is a taught word or a previously mastered phrase, not necessarily one character. Cause/contrast and 是…的 require two-step clause construction with familiar chunks; never hide unseen vocabulary inside a chunk. Several patterns belong in scene selection, listening, and matching rather than isolated English gloss questions. Accept natural alternative orders where valid and avoid distractors that are equally correct.

First exposure: Chinese target/English weapon, gradually adding choices; then matching in boards of five pairs; then a village reward. Function words first appear in a short contextual sentence/scene and are reinforced through ordering. The match game remains a short break. Collected cards progressively fill sets; building upgrades require both coins and the relevant learned set. Chinese/pinyin remains the player-facing building text; English here is for design and answer cards.

Phonology: practise four tones and neutral tone, third-tone changes, 一/不 tone changes, number reading, classifier pronunciation, and similar-sounding words. Reuse the male/female voice settings and speaking-card highlights. Use listening-only targets as optional variations; recognition games do not establish speaking or handwriting proficiency. Simplified/traditional and pinyin are display options for the same vocabulary, not extra set entries.

Economy proposal: payout = base correct-answer coins × permanent prestige multiplier × applicable village multiplier. Combine upgrades within a building, then apply explicitly shown district synergies; avoid an undocumented multiplier for every individual word. Wrong/unanswered attempts do not award coins; timing never lowers the saved mastery record. Passive/offline coins remain a small secondary benefit consistent with the existing game.

Campaign target: 8–16 weeks at roughly 10–20 minutes on most days; a tuning hypothesis, not a guaranteed learning outcome. First prestige after the number foundation and first meaningful village build, then approximately every 3–7 active days. Prestige resets coins, village buildings/upgrades, and active card collections. Keep permanent earnings bonuses, settings, and mastery/review history. Familiar sets rebuild through shorter review rounds; incorrect or overdue words get extra practice. No forced calendar gates. New frontier vocabulary stays at normal practice depth even when earnings multiply.

Milestones: L1–3 settlement/counting house; L4–9 homes and food; L10–14 school and services; L15–19 districts and transport; L20–25 town and coordination. Modern vocabulary leads naturally to a modernizing riverside town. A new run rapidly rebuilds familiar districts before adding a new frontier district. Sets continue to give partial bonuses and a larger completion bonus; all village bonuses reset on prestige.
'''

levelrows=[]
for level in levels:
    items=[r for r in vocabulary if r['Game level']==level['level']]
    stageids=list(dict.fromkeys(g['Sentence stage'] for g in grammar if g['After level']==level['level']))
    levelrows.append({'Level':level['level'],'Theme':level['title'],'HSK entries':level['new_entries'],'New cards incl. additions':level['card_count'],'Words + English':'; '.join(r['Chinese']+' — '+r['English'] for r in items),'Village':level['village'],'Sentence stages':', '.join(stageids) or 'Review familiar patterns'})
extra_rows=[{'Level':x[0],'Chinese':x[1],'English':x[2],'Status':x[3],'Additional new cards':x[4]} for x in extensions]

def mdtable(rows):
    fields=list(rows[0]);out=['| '+' | '.join(fields)+' |','| '+' | '.join('---' for _ in fields)+' |']
    out+=['| '+' | '.join(str(r[f]).replace('|',' / ').replace('\n',' ') for f in fields)+' |' for r in rows]
    return '\n'.join(out)
md='# HSK 1–2 → game and village mapping\n\n'+intro+'\n## Level overview\n\n'+mdtable(levelrows)+'\n\n## Complete vocabulary: 300 entries\n\n'+mdtable(vocabulary)+'\n\n## Grammar and sentence interactions\n\n'+mdtable(grammar)+'\n\n## Extensions and edition bridges\n\n'+mdtable(extra_rows)+'\n\n## Play, progression, and prestige rules\n\n'+rules+'\n## Sources and audit\n\n'
md+='\n'.join('- ['+name+']('+url+')' for name,url in sources)
audit={'baseline':'Pinned classic HSK 1–2 transcription; earlier official classic edition','hsk1':150,'hsk2_additional':150,'unique_entries':len(vocabulary),'unmapped':[],'duplicate_assignments':[],'max_new_cards_per_core_level':max(x['card_count'] for x in levels),'grammar_patterns':len(grammar),'sentence_stages':len(set(g['Sentence stage'] for g in grammar)),'source_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'sources').glob('*.csv')}}
md+='\n\nAudit: '+json.dumps(audit,ensure_ascii=False,indent=2)+'\n'
(ROOT/'hsk-game-mapping.md').write_text(md,encoding='utf-8')
(ROOT/'mapping.json').write_text(json.dumps({'levels':levels,'vocabulary':vocabulary,'grammar':grammar,'extensions':extra_rows,'audit':audit},ensure_ascii=False,indent=2),encoding='utf-8')
for name,rows in [('vocabulary',vocabulary),('grammar',grammar)]:
    with (ROOT/(name+'.csv')).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def htable(rows):
    fields=list(rows[0]);return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+html.escape(f)+'</th>' for f in fields)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(r[f]))+'</td>' for f in fields)+'</tr>' for r in rows)+'</tbody></table></div>'
def paragraphs(text):return ''.join('<p>'+html.escape(p)+'</p>' for p in text.strip().split('\n\n'))
sections=[('levels','Levels',htable(levelrows)),('vocab','All 300 words',htable(vocabulary)),('grammar','76 grammar patterns',htable(grammar)),('extras','Edition bridges',htable(extra_rows)),('rules','Game rules',paragraphs(rules))]
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HSK → Village · Design mapping</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f1e7;color:#183f35;font:16px/1.6 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:32px}h1{font-size:36px;line-height:1.15;margin:8px 0 16px}p{max-width:1050px}.badge{color:#776039;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.toolbar{position:sticky;top:0;background:#f5f1e7f5;padding:14px 0;z-index:2;border-bottom:1px solid #d9cfb6}nav{display:flex;gap:8px;flex-wrap:wrap}button,input{font:inherit;padding:9px 14px;border:1px solid #b9bba8;border-radius:8px}button{cursor:pointer;background:#fffdf5;color:#183f35}button[aria-pressed=true]{background:#245747;color:white}input{margin-top:12px;width:min(100%,530px)}.table-wrap{overflow:auto;max-height:72vh;margin-top:20px;border:1px solid #d5cbb4;border-radius:10px}table{border-collapse:collapse;width:100%;background:#fffef8;font-size:14px}th{position:sticky;top:0;background:#e6eadb;text-align:left;white-space:nowrap}th,td{padding:12px 15px;border-bottom:1px solid #e3ddcc;vertical-align:top}td{min-width:100px}tbody tr:nth-child(even){background:#f8f7ed}tbody tr:hover{background:#fff2bf}#levels td:nth-child(5){min-width:430px}#vocab td:nth-child(1){font-size:19px;font-weight:650}#grammar td:nth-child(6){font-size:18px;min-width:180px}a{color:#286453}section[hidden],tr[hidden]{display:none}.summary{padding:16px;background:#e8eddd;border-radius:12px;font-weight:600}details{margin:18px 0}@media(max-width:650px){main{padding:18px}h1{font-size:28px}}@media print{.toolbar{display:none}section[hidden]{display:block}.table-wrap{max-height:none;overflow:visible}th{position:static}table{font-size:10px}td{min-width:0!important}}
</style><main><div class="badge">Design proposal · Classic HSK scope · 17 September 2026</div><h1>Words become a village.</h1><p class="summary">300 vocabulary entries · 25 core word levels · 76 grammar patterns · No core level exceeds 20 new cards</p><details><summary>Scope, corrections, and counting rules</summary>'''+paragraphs(intro)+'''</details><div class="toolbar"><nav aria-label="Mapping views">'''+''.join('<button data-tab="'+id+'" aria-pressed="'+str(i==0).lower()+'">'+label+'</button>' for i,(id,label,_) in enumerate(sections))+'''</nav><input id="search" type="search" placeholder="Search Chinese, English, pattern, or village…" aria-label="Filter the current table"><span id="count" role="status"></span></div>'''+''.join('<section id="'+id+'" '+('hidden' if i else '')+'><h2>'+label+'</h2>'+content+'</section>' for i,(id,label,content) in enumerate(sections))+'<details><summary>Sources and coverage audit</summary><ul>'+''.join('<li><a href="'+url+'">'+name+'</a></li>' for name,url in sources)+'</ul><pre>'+html.escape(json.dumps(audit,indent=2))+'</pre></details>'+'''<script>
const search=document.querySelector('#search');function filter(){const rows=[...document.querySelectorAll('section:not([hidden]) tbody tr')],q=search.value.toLowerCase().trim();rows.forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));document.querySelector('#count').textContent=rows.length?' '+rows.filter(r=>!r.hidden).length+' / '+rows.length+' rows':''}document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('section').forEach(s=>s.hidden=s.id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',x===b));filter()});search.oninput=filter;filter();</script></main></html>'''
(ROOT/'index.html').write_text(page,encoding='utf-8')
print(json.dumps(audit,indent=2))
