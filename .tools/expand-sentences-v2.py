import json,itertools
from pathlib import Path
r=Path(__file__).resolve().parents[1]/'game-v2'
manifest=json.loads((r/'lessons/index.json').read_text('utf-8'))
docs=[(r/'lessons'/f,json.loads((r/'lessons'/f).read_text('utf-8'))) for f in manifest['sets']]
words={w['simplified']:w for _,d in docs for w in d.get('pairs',[])}
subjects=[('我','I'),('你','You'),('他','He'),('她','She'),('我们','We')]
predicates={
5:[('在 家','am at home','is at home','are at home'),('有 家','have a home','has a home'),('回 家','return home','returns home'),('来 这儿','come here','comes here'),('去 那儿','go there','goes there'),('住 这儿','live here','lives here')],
6:[('喝 水','drink water','drinks water'),('喝 茶','drink tea','drinks tea'),('要 水','want water','wants water'),('要 茶','want tea','wants tea'),('想 喝 水','want to drink water','wants to drink water'),('不 喝 茶','do not drink tea','does not drink tea')],
7:[('吃 米饭','eat rice','eats rice'),('吃 苹果','eat apples','eats apples'),('买 菜','buy vegetables','buys vegetables'),('买 水果','buy fruit','buys fruit'),('要 吃饭','want to eat','wants to eat'),('去 商店','go to the shop','goes to the shop')],
8:[('爱 妈妈','love Mom','loves Mom'),('爱 爸爸','love Dad','loves Dad'),('喜欢 苹果','like apples','likes apples'),('认识 他','know him','knows him'),('有 朋友','have friends','has friends'),('也 喝 茶','also drink tea','also drinks tea')],
9:[('有 书','have books','has books'),('买 衣服','buy clothes','buys clothes'),('开 门','open the door','opens the door'),('坐 这儿','sit here','sits here'),('穿 衣服','wear clothes','wears clothes'),('要 椅子','want a chair','wants a chair')],
10:[('今天 回 家','return home today','returns home today'),('明天 去 商店','go to the shop tomorrow','goes to the shop tomorrow'),('现在 在 家','am at home now','is at home now','are at home now'),('今天 买 菜','buy vegetables today','buys vegetables today'),('明天 来 这儿','come here tomorrow','comes here tomorrow'),('现在 喝 水','drink water now','drinks water now')],
11:[('上午 工作','work in the morning','works in the morning'),('中午 吃饭','eat at noon','eats at noon'),('下午 休息','rest in the afternoon','rests in the afternoon'),('晚上 睡觉','sleep at night','sleeps at night'),('早上 起床','get up early in the morning','gets up early in the morning'),('很 累','am tired','is tired','are tired')],
12:[('学习 汉语','study Chinese','studies Chinese'),('会 写 字','can write characters','can write characters'),('读 书','read books','reads books'),('去 学校','go to school','goes to school'),('是 学生','am a student','is a student','are students'),('听 老师 说话','listen to the teacher speak','listens to the teacher speak')],
13:[('欢迎 您','welcome you','welcomes you'),('迎接 客人','welcome guests','welcomes guests'),('谢谢 您','thank you','thanks you'),('请 您 坐','invite you to sit','invites you to sit'),('是 客人','am a guest','is a guest','are guests'),('想 问 什么','want to ask what','wants to ask what')],
14:[('去 医院','go to the hospital','goes to the hospital'),('是 医生','am a doctor','is a doctor','are doctors'),('生病 了','have become ill','has become ill'),('买 药','buy medicine','buys medicine'),('身体 很 好','am in good health','is in good health','are in good health'),('很 冷','am cold','is cold','are cold')],
15:[('卖 水果','sell fruit','sells fruit'),('买 新 衣服','buy new clothes','buys new clothes'),('去 市场','go to the market','goes to the market'),('找 朋友','look for friends','looks for friends'),('给 他 水','give him water','gives him water'),('买 便宜 东西','buy inexpensive things','buys inexpensive things')],
16:[('喝 牛奶','drink milk','drinks milk'),('喝 咖啡','drink coffee','drinks coffee'),('吃 鸡蛋','eat eggs','eats eggs'),('吃 羊肉','eat lamb','eats lamb'),('买 西瓜','buy watermelon','buys watermelon'),('去 饭馆','go to a restaurant','goes to a restaurant')],
17:[('帮助 哥哥','help an older brother','helps an older brother'),('帮助 姐姐','help an older sister','helps an older sister'),('爱 孩子','love children','loves children'),('有 妹妹','have a younger sister','has a younger sister'),('有 弟弟','have a younger brother','has a younger brother'),('认识 大家','know everyone','knows everyone')],
18:[('走 这儿','go this way','goes this way'),('到 学校','arrive at school','arrives at school'),('从 家 来','come from home','comes from home'),('向 左边 走','walk to the left','walks to the left'),('向 右边 走','walk to the right','walks to the right'),('在 门 外','am outside the door','is outside the door','are outside the door')],
19:[('坐 飞机','take an airplane','takes an airplane'),('坐 公共汽车','take a bus','takes a bus'),('去 北京','go to Beijing','goes to Beijing'),('买 票','buy a ticket','buys a ticket'),('到 机场','arrive at the airport','arrives at the airport'),('想 旅游','want to travel','wants to travel')],
20:[('很 高兴','am happy','is happy','are happy'),('会 唱歌','can sing','can sing'),('会 跳舞','can dance','can dance'),('喜欢 红 衣服','like red clothes','likes red clothes'),('非常 快乐','am very happy','is very happy','are very happy'),('去 广场','go to the square','goes to the square')],
21:[('喜欢 运动','like sports','likes sports'),('会 游泳','can swim','can swim'),('打篮球','play basketball','plays basketball'),('踢足球','play football','plays football'),('跑步','jog','jogs'),('喜欢 猫','like cats','likes cats')],
22:[('看 电视','watch television','watches television'),('看 电影','watch movies','watches movies'),('买 手机','buy a mobile phone','buys a mobile phone'),('打电话','make a phone call','makes a phone call'),('去 公司','go to the company','goes to the company'),('看 报纸','read newspapers','reads newspapers')],
23:[('回答 问题','answer questions','answers questions'),('懂 汉语','understand Chinese','understands Chinese'),('知道 答案','know the answer','knows the answer'),('去 教室','go to the classroom','goes to the classroom'),('有 考试','have an exam','has an exam'),('问 老师','ask the teacher','asks the teacher')],
24:[('准备 回 家','prepare to go home','prepares to go home'),('已经 吃饭 了','have already eaten','has already eaten'),('正在 工作','am working','is working','are working'),('可以 休息','can rest','can rest'),('开始 学习','begin studying','begins studying'),('希望 去 中国','hope to go to China','hopes to go to China')],
}
# Use only taught words: avoid later 问 in level 13, and untaught 答案.
predicates[13][-1]=('请 客人 喝茶','invite guests to drink tea','invites guests to drink tea')
predicates[13][-1]=('请 客人 坐','invite guests to sit','invites guests to sit')
predicates[23][2]=('知道 这件事','know about this','knows about this')
predicates[23][2]=('知道 名字','know the name','knows the name')
for path,d in docs:
 if d['type']!='pairs': continue
 n=d['level']; rows=[]
 def add(cn,en):
  ts=cn.split(); assert 1<=len(ts)<=4,(n,cn)
  ws=[words[t] for t in ts]
  assert all(int(w['id'][1:3])<=n for w in ws),(n,cn)
  if cn not in [q[0] for q in rows]: rows.append((cn,en))
 if n==1:
  for a,b in itertools.product(list('一二三四五六'),list('一二三四五')):
   add(a+' '+b,words[a]['english']+', '+words[b]['english'])
 elif n==2:
  for a in ['十','二十','三十','五十']:
   for b in list('一二三四五六七八九'):
    base={'十':10,'二十':20,'三十':30,'五十':50}[a];add(a+' '+b,str(base+list('一二三四五六七八九').index(b)+1))
 elif n==3:
  for a in list('一二三四五六七八九'):
   for b,value in [('百',100),('千',1000),('万',10000),('亿',100000000)]:
    add(a+' '+b,f'{(list("一二三四五六七八九").index(a)+1)*value:,}')
 elif n==4:
  for cn,en in subjects:
   add(cn+' 是 谁', 'Who '+('am I' if cn=='我' else 'are '+en.lower() if cn in ['你','我们'] else 'is '+en.lower())+'?')
   add(cn+' 的 名字',en.replace('I','My').replace('You','Your').replace('He','His').replace('She','Her').replace('We','Our')+' name')
  for a in list('一二三四五六七八九'):
   add(a+' 人',words[a]['english']+' '+('person' if a=='一' else 'people'))
  for a in ['十','十一','十二','十五','二十','二十一','三十','五十','九十九']:
   add(a+' 人',words[a]['english']+' people')
  add('你 是 他 吗','Are you him?');add('他 是 谁','Who is he?');add('她 是 你 吗','Is she you?');add('我 是 谁','Who am I?')
 elif n==25:
  for cn,en in subjects:
   for a,b,meaning in [('冷','休息','it is cold, rest'),('累','休息','tired, rest'),('忙','工作','busy, work')]:
    # Two clauses, each within four cards.
    add('因为 '+cn+' 很 '+a,'Because '+en.lower()+' '+('am' if cn=='我' else 'are' if cn in ['你','我们'] else 'is')+' '+{'冷':'cold','累':'tired','忙':'busy'}[a]+'.')
    add('所以 '+cn+' '+b,'So '+en.lower()+' '+(b=='休息' and ('rests' if cn in ['他','她'] else 'rest') or ('works' if cn in ['他','她'] else 'work'))+'.')
  # Duplicate resulting rest clauses are replaced by useful contrast/questions.
  for cn,en in subjects:
   add('但是 '+cn+' 不 去','But '+en.lower()+' '+('does' if cn in ['他','她'] else 'do')+' not go.')
   add(cn+' 为什么 不 来','Why '+('does' if cn in ['他','她'] else 'do')+' '+en.lower()+' not come?')
 else:
  for cn,en in subjects:
   for pred,*forms in predicates[n]:
    form=forms[1] if cn in ['他','她'] else forms[2] if len(forms)>2 and cn!='我' else forms[0]
    add(cn+' '+pred,en+' '+form+'.')
 assert len(rows)>=30,(n,len(rows))
 d['countPerRun']=10
 d['sentences']=[{'id':f'{d["id"]}-sentence-{i+1}','tokens':[words[t]['id'] for t in cn.split()], 'english':en} for i,(cn,en) in enumerate(rows)]
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Sentence pools added to every word level')
