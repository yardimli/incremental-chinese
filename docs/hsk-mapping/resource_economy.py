"""Resource-economy revision of the design catalogue; no gameplay changes."""
from math import ceil
from economy import build_economy as previous_catalogue, base, advancement_gates, money

RESOURCES=[
 {'Resource':'木材 · mùcái · Timber','Role':'Construction','Unlock':'L1 set cleared','Produced by':'I01 Timber yard; 12/min per copy','Exchange':'Buy for coins; 3 × B(H) per unit','Base storage':200},
 {'Resource':'石料 · shíliào · Stone','Role':'Construction','Unlock':'L1 set cleared','Produced by':'I02 Stone yard; 8/min per copy','Exchange':'Buy for coins; 5 × B(H) per unit','Base storage':200},
 {'Resource':'砖 · zhuān · Bricks','Role':'Construction','Unlock':'L8 set cleared','Produced by':'I05 Kiln; consumes 4 timber + 4 stone/min to produce 2 bricks/min per copy','Exchange':'Buy for coins; 16 × B(H) per unit','Base storage':100},
 {'Resource':'知识 · zhīshi · Knowledge','Role':'Research','Unlock':'L1 set cleared','Produced by':'I03 Study hut; 3/min per copy; Community/Study projects supplement it','Exchange':'Not tradable, not sold for coins','Base storage':100},
 {'Resource':'心得 · xīndé · Insight','Role':'Research','Unlock':'L8 set cleared','Produced by':'I06 Practice hall; 1/min per copy; later Study projects supplement it','Exchange':'Not tradable, not sold for coins','Base storage':50}
]

INFRASTRUCTURE=[
 {'ID':'I01','Building':'Timber yard','Unlock':'Clear L1; free blueprint','First-copy coins':100,'Timber':0,'Stone':0,'Bricks':0,'Output per copy':'12 timber/min','Inputs':'None','Land':1},
 {'ID':'I02','Building':'Stone yard','Unlock':'Clear L1; free blueprint','First-copy coins':120,'Timber':0,'Stone':0,'Bricks':0,'Output per copy':'8 stone/min','Inputs':'None','Land':1},
 {'ID':'I03','Building':'Study hut','Unlock':'Clear L1; free blueprint; no research required','First-copy coins':100,'Timber':0,'Stone':0,'Bricks':0,'Output per copy':'3 knowledge/min','Inputs':'None','Land':1},
 {'ID':'I04','Building':'Storehouse','Unlock':'Clear L2; free blueprint','First-copy coins':160,'Timber':20,'Stone':10,'Bricks':0,'Output per copy':'+100% of each unlocked resource’s base storage; additive','Inputs':'None','Land':1},
 {'ID':'I05','Building':'Kiln','Unlock':'Clear L8; free blueprint; no brick prerequisite','First-copy coins':8*base(8),'Timber':30,'Stone':30,'Bricks':0,'Output per copy':'2 bricks/min','Inputs':'4 timber + 4 stone/min','Land':1},
 {'ID':'I06','Building':'Practice hall','Unlock':'Clear L8 plus any completed sentence stage this run; free blueprint','First-copy coins':10*base(8),'Timber':30,'Stone':20,'Bricks':0,'Output per copy':'1 insight/min','Inputs':'None','Land':1}
]

def build_economy():
    _,old_projects,research=previous_catalogue(); projects=[];levels=[]
    for r in research:
        n=r['Level'];r['Knowledge']=ceil(2*1.22**(n-1));r['Insight']=0 if n<8 else ceil(1.18**(n-8))
        r['Price (coins)']=0
        r['Payment']='Knowledge + Insight only; coins cannot substitute'
        r['Requires']=r['Requires'].replace('(optional bridge stage); claim no new village plot','(optional bridge stage); no additional land')
    for p in old_projects:
        n=p['Level'];b=p['ID'].endswith('B');factor=1.4 if b else 1
        timber=ceil(8*1.18**(n-1)*factor);stone=ceil(4*1.18**(n-1)*factor)
        bricks=0 if n<8 else ceil(3*1.18**(n-8)*factor)
        path=p['Path'];knowledge=round(n*(.15 if path=='Study' else .04),2) if path!='Trade' else 0
        insight=round(.03*(n-7),2) if path=='Study' and n>=8 else 0
        projects.append({'ID':p['ID'],'Level':n,'Path':path,'Chinese label':p['Chinese label'],'Project':p['Project'],
          'Build price (coins)':p['Build price (coins)'],'Timber':timber,'Stone':stone,'Bricks':bricks,
          'Requires':p['Requires'].replace('(rank 1+)','(one copy+)'),'Research ID':p['Research ID'],
          'Land per copy':1,'Repeat cost':'ceil(first cost × 1.18^copies already owned), separately for each cost',
          'Effect':f"+{p['Contribution per rank']} × 0.7^(copy index−1) to {p['Scope']} per copy",
          'Scope':p['Scope'],'Contribution per copy':p['Contribution per rank'],
          'Knowledge/min per copy':knowledge,'Insight/min per copy':insight,
          'Coins/min per copy':round(.01*base(n),2)})
    for n in range(1,28):
        options=[p for p in projects if p['Level']==n];a,b=options
        def describe(p):
            r=next(r for r in research if r['ID']==p['Research ID'])
            return f"{p['ID']} {p['Project']}: {money(p['Build price (coins)'])} coins + {p['Timber']} timber + {p['Stone']} stone + {p['Bricks']} bricks; research {r['ID']}: {r['Knowledge']} knowledge + {r['Insight']} insight"
        levels.append({'Level':n,'Base correct-answer coins':base(n),'Total land':4+min(n,25),
          'Option A — first copy':describe(a),'Option B — first copy':describe(b),
          'Limit':'May own both and repeat either; research, land and materials constrain purchases'})
    return levels,projects,research

def resource_gates():
    gates=advancement_gates()
    for g in gates:g['Choice']='Any paths; strength = min(3, copies owned) per active project type; infrastructure excluded'
    return gates

ADVANCEMENT_RULES='''Progression still requires a completed learning set AND its village milestone. Current-level blueprints/production infrastructure unlock before checking the next-level gate. Word and matching completion make that level's research eligible; paying its research resources opens the project, then coins and materials purchase each copy.

Village strength is now sum(min(3, active copies of each project type)). There are no building ranks. Resource infrastructure contributes zero strength. This replaces the old rank-based formula without allowing 100 cheap timber yards to complete the campaign. All gate numbers remain as listed: strength ceil(N/2), 1 + floor(N/3) completed research nodes, one active project type from the most recent five levels, and floor(N/3) distinct cleared sentence stages. S03.0 supplies the first sentence milestone. Optional L26/27 buildings do not satisfy core gates before L25 completion.

Build three copies of fewer project types, or one copy of more types. Only one copy of an earlier same-path project is needed as a foundation; duplicate copies do not create extra research prerequisites. At L1 the player must first buy the coin-only Study hut to produce knowledge, research either starter blueprint, then construct one starter. Materials can come from production or the exchange. L1 completion guarantees a one-time 250-coin settlement grant, in addition to normal gameplay income; it cannot be claimed repeatedly by replaying L1. This funds the 100-coin Study hut even if earlier coins were spent. Review gameplay remains available to earn any further coins.

Already unlocked word and sentence content is always replayable. Research can impose a production wait; more producer buildings shorten it, but knowledge and insight cannot be bought or converted from coins. Research is completed instantly once its resources are paid. Future levels cannot supply resources needed by an earlier gate: bricks and insight are first required at L8, where their coin/material-only producers unlock before the gate. Neither requires itself to construct its first producer.

Next-level unlocks latch for the current run. Demolition may reduce future eligibility but cannot relock lessons. Prestige resets buildings, all five resource balances, research, storage upgrades, land expansion and village milestones; retain settings, mastery history and permanent coin multiplier. Earned multipliers never bypass a level, blueprint or resource prerequisite.
'''

ECONOMY_RULES='''Resource economy revision: coins remain the primary reward from correct word, matching and sentence gameplay. Add exactly three construction resources (timber, stone, bricks) and two research resources (knowledge, insight). All five can be produced by buildings. Knowledge and insight have no exchange price, direct-purchase button, coin conversion or resource-trade recipe. All buildings, including production buildings, always have a coin cost.

This revision replaces the earlier A-OR-B level plots, rank upgrades and coin-priced research. Every cleared core level adds one land tile to a shared village capacity: capacity = 4 + cleared core levels, up to 29. Each building copy, including infrastructure and storehouses, occupies one tile. Optional bridges add no land. Both A and B may be built if their research and foundations are satisfied; every type can be purchased repeatedly up to available land and storage constraints. A type's copies may be grouped visually behind a ×N counter. Building copies replace ranks everywhere, including synergies and advancement.

Price of the next copy: ceil(C0 × 1.18^k), where C0 is its first-copy cost and k is the number currently owned. Apply this separately to coins, timber, stone and bricks; a zero requirement stays zero. The same rule applies to infrastructure. Purchase batches sum each successive copy price, never multiply the current price by quantity. Research is purchased once per node per run and does not scale with copies. Demolition returns no resources or coins, frees one tile and lowers k; it cannot create a resale profit. Removing the last required foundation makes dependent projects dormant until rebuilt; dormant buildings occupy land but produce nothing and give no strength or earnings bonus.

Word-set unlocks, previous same-path research, learned sentence prerequisites and earlier same-path foundations still apply. Infrastructure is shared across strategies and does not require choosing Trade, Community or Study. This keeps specialist paths viable without making Study projects compulsory for research production. The Study path improves research throughput as well as sentence earnings; Trade prioritizes active coin income and can fund material exchange; Community improves matching income and can spend land on balanced production.

Construction recipes grow independently of coin inflation: first-copy timber = ceil(8 × 1.18^(L−1) × F), stone = ceil(4 × 1.18^(L−1) × F), and bricks = 0 before L8, otherwise ceil(3 × 1.18^(L−8) × F). F=1 for option A and 1.4 for B. First-copy coin prices keep the previous ladder: A=60×B(L), B=95×B(L), B(L)=round-half-up(10×1.6^(L−1)). Research costs knowledge=ceil(2×1.22^(L−1)) and insight=0 before L8, otherwise ceil(1.18^(L−8)). Both alternatives have the same research resource formula; their project recipes and effects differ.

The exchange unlocks free when L1 is cleared. It sells only unlocked construction materials for coins: timber 3×B(H), stone 5×B(H), bricks 16×B(H) per unit, where H is the highest core set cleared this run. No selling, material-to-material swapping, technology-resource trades or direct speedups. Show exact batch price before confirmation. Buy quantity is capped by wallet and remaining storage. Rate increases follow frontier coin income and reset on prestige; stock is limited by storage, not daily quotas. Kiln crafting costs eight combined material units per two bricks; exchanging materials and crafting cannot return coins or create a trading arbitrage loop.

Production uses real elapsed time and is linear per active copy; the table lists per-minute rates, with fractional amounts accumulated internally. Timber and stone sources have no input. Kilns consume 2 timber + 2 stone per brick actually produced: process only what inputs and output capacity allow, and never consume inputs while brick storage is full. Allocate a scarce shared input proportionally between identical kilns; show actual output and bottlenecks. Practice halls produce insight without consuming knowledge, so the player cannot accidentally exhaust the research resource needed to unlock its own producer.

Base storage: timber 200, stone 200, bricks 100, knowledge 100, insight 50. Each storehouse adds another full base-storage amount to every unlocked resource; capacity = base × (1 + storehouse copies). Storage upgrades use coins, timber and stone only, never bricks or technology. Before a purchase, show required storage where a recipe exceeds capacity. Storage and land are intended choices, but never allow a permanent storage deadlock: storage-expansion costs can be paid in nonrefundable instalments from current stock; each instalment is recorded against that specific next storehouse price and the tile is reserved. Completion adds the building, frees the payment record and increases capacity. No other building or research has instalment payments.

Demolishing storage first previews any overflow. Overflow is retained but cannot increase further until spent below the new cap; never delete stored resources. A reserved storehouse can be cancelled to release land, but its paid instalments are lost. A player with full land can demolish a copy to make room. No generation pauses merely because storage is full: cap that resource and continue unrelated production. Resources never go negative.

Active gameplay payout = floor(B(L) × event weight × permanent prestige multiplier × (1 + relevant path contribution) × (1 + U)). For each project type, copy i adds its listed path contribution × 0.7^(i−1); contributions sum across copies and types. Production remains linear per copy, so an additional copy may be worthwhile for resources even when its coin-reward contribution is diminishing. Event weights remain word hit 1, correct match pair 2, first matching-board clear 5, correct sentence 4, first sentence-stage clear 10. Set awards remain 10×B(L)×P×(1+U). Review uses the reviewed level's base, not the frontier rate.

Each thematic project also generates a small 0.01×B(its unlock level) coins/minute per copy, with no W/M/S or prestige multiplier. Replace the old generic passive-set coin source rather than stacking both. Total passive coin income over any rolling 24 hours is capped at 10% of active coins earned over the preceding rolling 24 hours. No recent active play means no passive coins. Construction and research production are not subject to that coin cap.

Resource production continues while the game is paused or closed, capped at eight hours per absence and by storage/input availability. Resume shows a single reconciled resource summary. Calculate production piecewise as inputs exhaust or storage fills, not by naively multiplying every output by hours independently. Offline knowledge/insight is building-earned income, never a direct purchase. Track last-accrual timestamps and reconcile once under the same save lock used for coins to prevent double awards from multiple tabs. Clamp negative elapsed time; clock manipulation safeguards are a later implementation concern.

Five resource labels extend the vocabulary plan: introduce 木材, 石料, 知识 in a separate three-card resource stage after L1; introduce 砖 and 心得 in a two-card resource stage after L8. These are game-specific additions, not counted among the classic 300 words. Teach and voice them before requiring recognition, and keep every stage under 20 new cards. Earlier labels still use taught vocabulary; English construction/research titles in this document are design descriptions, not additional required cards.

Bootstrap example: clear L1 → receive the 250-coin grant → buy I03 for 100 coins → generate the first 2 knowledge in 40 seconds → research R01A or R01B. Build P01A for 600 coins + 8 timber + 4 stone, or P01B for 950 coins + 12 timber + 6 stone. Produce the materials by purchasing yards, or buy them at the exchange. The initial five land tiles fit I01, I02, I03 and two project copies. A specialist can skip one or both yards initially and use coins for materials, saving land for production or copies later.

Production and prices are initial tuning proposals, not a validated 2–4 month balance. Measure first-research wait, next-project wait, storage bottlenecks, land occupancy and earnings by strategy. Keep early research around a minute with its starter producer; later waits should reward planning and additional producers rather than force a particular path. All buildings, resources, research and land reset on prestige, so old vocabulary rebuilds the village using improved permanent active-coin rewards.
'''

SYNERGIES=[
 {'Unlock':'L8','Name':'Shared neighbourhood','Requirement':'Active project types in two paths','Bonus':'+0.10 U once'},
 {'Unlock':'L12','Name':'Specialist district','Requirement':'Four distinct active types in one path, with at least two copies of one type','Bonus':'+0.15 U once across paths'},
 {'Unlock':'L18','Name':'Connected town','Requirement':'Active project types in all three paths','Bonus':'+0.15 U once'},
 {'Unlock':'L25','Name':'Established town','Requirement':'Eight distinct active types in one path OR twelve distinct active types across paths','Bonus':'+0.20 U once'}
]
STRATEGIES=[
 {'Style':'Trade + exchange','Investment':'Trade project copies; coin-funded material exchange; shared tech producers','Advantage':'Convert strong active earnings into immediate construction materials','Constraint':'Cannot buy research resources; exchange becomes more expensive at the frontier'},
 {'Style':'Production + Community','Investment':'Timber/stone yards, kilns, storage and matching projects','Advantage':'Save coins on materials and return to stored production','Constraint':'Producers occupy land that could hold reward multipliers'},
 {'Style':'Study + research','Investment':'Study hut, practice halls and Study project copies','Advantage':'Faster technology unlocks and better sentence rewards','Constraint':'Research does not pay building coins or supply construction materials'},
 {'Style':'Mixed village','Investment':'A small production base, selected copies and multiple research paths','Advantage':'Adapt to the current bottleneck without committing every tile to one activity','Constraint':'Spread spending across more blueprints and recipes'}
]
