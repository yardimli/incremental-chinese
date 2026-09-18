"""Design-only prices and dependency graph. Does not modify the playable game."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP

ROOT=Path(__file__).parent
PATHS={'Trade':('W',Decimal('.30')),'Community':('M',Decimal('.40')),'Study':('S',Decimal('.50'))}
def base(level):
    return int((Decimal(10)*Decimal('1.6')**(level-1)).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def price(value):
    return int(Decimal(value).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def money(value):return f'{value:,}'

def build_economy():
    projects=[];research=[];levels=[];last={}
    for line in (ROOT/'village-projects.txt').read_text(encoding='utf-8').splitlines():
        fields=line.split('|');level=int(fields[0]);b=base(level); choices=[]
        for i,letter in enumerate('AB'):
            path,label,name,topic=fields[1+i*4:5+i*4]
            pid=f'P{level:02d}{letter}';rid=f'R{level:02d}{letter}';prior=last.get(path)
            research_price=(20 if i==0 else 30)*b
            build_price=(60 if i==0 else 95)*b
            scope,increment=PATHS[path]
            # B spends more for a stronger specialist contribution, not a different currency.
            contribution=increment*(Decimal('1.5') if i else 1)
            prereq=f'Complete word set L{level:02d} this run'
            if level in [26,27]:prereq+=f' (optional bridge stage); claim no new village plot'
            research.append({'ID':rid,'Level':level,'Path':path,'Research':topic,'Price (coins)':research_price,'Requires':prereq+('; '+prior if prior else '; no earlier research'),'Unlocks':pid+' '+name,'Previous research ID':prior or ''})
            requires=rid
            if level>=7:requires+=f'; own any earlier {path} project (rank 1+)'
            if path=='Study':requires+='; complete any one eligible sentence stage this run'
            projects.append({'ID':pid,'Level':level,'Path':path,'Chinese label':label,'Project':name,'Build price (coins)':build_price,'Research price (coins)':research_price,'Rank 2 price (coins)':price(Decimal(build_price)*Decimal('2.4')),'Rank 3 price (coins)':price(Decimal(build_price)*Decimal('2.4')**2),'Requires':requires,'Slot':f'L{level:02d} project slot' if level<=25 else f'Replaces any existing {path} project; no extra slot','Effect':f'+{contribution} to {scope} per rank (additive within path)','Research ID':rid,'Contribution per rank':float(contribution),'Scope':scope})
            choices.append(f'{pid} {label} — {name}: {money(build_price)} coins; research {rid}: {money(research_price)}; total {money(build_price+research_price)}')
            last[path]=rid
        levels.append({'Level':level,'Base correct-answer coins':b,'Reference gross envelope (180 × base)':180*b,'Option A: building + research':choices[0],'Option B: building + research':choices[1],'Both options, research + rank 1 (comparison only)':sum(p['Build price (coins)']+p['Research price (coins)'] for p in projects if p['Level']==level),'Limit':'Choose one active project; meet the village milestone to advance' if level<=25 else 'Optional replacement, no extra plot'})
    ids={r['ID']:r for r in research}
    assert len(ids)==54
    for r in research:
        if r['Previous research ID']:
            parent=ids[r['Previous research ID']]
            assert parent['Level']<r['Level'] and parent['Path']==r['Path']
    assert all(x['Both options, research + rank 1 (comparison only)']>x['Reference gross envelope (180 × base)'] for x in levels)
    assert all(base(n+1)>base(n) for n in range(1,27))
    return levels,projects,research

def advancement_gates():
    return [{'Cleared level':n,'Unlocks':f'L{n+1:02d}' if n<25 else 'Campaign completion + optional bridge levels',
             'Learning requirement':f'Complete L{n:02d} word rounds and all matching boards; claim its set award',
             'Village strength required':(n+1)//2,'Research nodes required':1+n//3,
             'Recent project requirement':f'Own one active project from L{max(1,n-4):02d}–L{n:02d}',
             'Sentence milestone':'Complete one distinct sentence stage per three cleared word levels: '+str(n//3)+' total this run' if n>=3 else 'None',
             'Choice':'Any mix of paths; no named project required'} for n in range(1,26)]

ADVANCEMENT_RULES='''Advancement now has BOTH learning and game requirements. Clearing the current word set and matching boards first makes its research and project slot available. The next word level stays locked until the village milestone in the gate table is met. This order is essential: current-level construction must become available before evaluating the next-level gate, so players can never need the locked next level to unlock itself.

Village strength is the sum of ranks of active projects: rank 1 contributes 1, rank 2 contributes 2, rank 3 contributes 3. It is a progress statistic, not a second currency. Dormant projects contribute zero. Clearing level N requires strength ceil(N/2), at least 1 + floor(N/3) purchased research nodes, and one active project introduced within levels max(1,N−4) through N. These are cumulative current-run requirements, not fresh purchases at every gate. Each three word levels also require one additional distinct cleared sentence stage; S03.0 makes the first sentence milestone available in time.

Examples: L1 → L2 needs the first researched rank-1 project. L3 → L4 needs strength 2, two research nodes and one sentence-stage clear. L10 → L11 needs strength 5, four research nodes, an active L6–10 project and three sentence-stage clears. L20 → L21 needs strength 10, seven research nodes, an active L16–20 project and six sentence-stage clears. Completing L25 needs strength 13, nine research nodes, an active L21–25 project and eight sentence-stage clears. Numbers are tuning proposals; playtest gate wait times alongside the catalogue prices.

Players can build more rank-1 projects or upgrade fewer projects to meet strength requirements. Research can follow any path or a mix. A Study specialist builds one Trade or Community starter at L1, then can specialize from L3. No particular research branch, synergy or named late-game building is compulsory. The recent-project requirement keeps the village evolving instead of allowing the entire campaign to rely on cheap starting buildings. It does not require purchasing every level's project.

While a next-level gate is locked, completed and current content stays replayable for coins, and all sentence stages whose vocabulary prerequisites are met remain accessible without owning their themed building. No failure or wrong answer removes coins. There is no real-time waiting requirement or forced prestige. Offer distinct word, match and sentence review routes so a player can earn the missing coins through their preferred strategy.

Show the next-level panel as a short checklist: set complete, strength X/Y, research X/Y, recent project, sentence milestones. Offer at least two valid purchase/upgrade routes where available and explain their total remaining coin cost including research dependencies. L1 is the deliberate exception: choose one of its two starter projects. Unlocks latch for the remainder of the run; replacing a building cannot relock previously opened lessons, although it can affect future gate eligibility. Prestige resets village milestones, research and run-level unlocks; retained mastery shortens familiar review but does not bypass the game milestones.
'''

ECONOMY_RULES='''This is a proposed balance specification, not a tested 2–4 month economy or an implementation change. Each core word set unlocks research eligibility and one project plot after its matching section is completed. Its two projects are visible before that point, but neither is purchasable yet. The next core word level requires both the learning clear and the village milestone described in Advancement gates. Purchases are strategically selective, but building a functioning village is required to advance. Sentence stages using already-unlocked vocabulary remain available regardless of ownership of their themed building.

Three strategies share one coin wallet. Trade improves correct word-target hits (W); Community improves correct match pairs and first-clear matching-board awards (M); Study improves correctly completed sentences (S). Research only grants blueprints; it produces no income or automatic multiplier. A player can mix paths, but must fund their research chains. Each node requires the previous node in its own path, not the previous level's entire catalogue. Researching a node never forces construction of its project. Each higher project (L7+) additionally needs any earlier owned project in the same path; introductory projects remain accessible as inexpensive foundations. Study construction additionally requires one completed eligible sentence stage; number-phrase stage S03.0 provides the first opportunity.

One project may occupy each core-level plot: A OR B, not both. Researching both is allowed, but buying both at the same plot is not. Levels never give a blanket right to purchase everything shown. Save coins, rank up an existing project, research forward, or build a competing project. A missing earlier branch can be researched later without replaying its lessons again in the same run. Future catalogue entries show name, price, multiplier scope, exact unmet requirements, and a project preview; show the next three levels prominently and keep a full town plan available.

Each project has ranks 1–3. Rank 1 requires its listed set; rank 2 requires completion of the next core word set; rank 3 requires completion of two later core sets. L24 rank 3 and L25 ranks 2–3 instead require 10 distinct sentence-stage clears after the final core set (replays count, with at most one milestone credit per stage). Bridge projects at L26/L27 use the same post-core condition for ranks 2–3, so their full ranks cannot be bought immediately. Rank 2 costs 2.4 × the original build price, and rank 3 costs 5.76 × that price; these are additional payments, not total investment. Core L25's rank 1 is available normally; post-core projects improve replay and future prestige value, not access to learning.

To replace an occupied core plot, pay the alternative project's full rank-1 price and meet its prerequisites. The old project's ranks disappear with no refund; its research stays until prestige. Show the exact payout change and dependency effects before replacement. Any later projects that lose their last required foundation become dormant rather than being deleted. Reactivate them by rebuilding a qualifying earlier foundation. Check foundations recursively and exclude the replaced project itself. There is no sale profit, research refund, or construction reward to farm. Prestige is the cheaper opportunity to rebuild with a different strategy.

Core equation: payout = floor(B(L) × event weight × P × (1 + applicable path contributions) × (1 + U)). B(L) = round-half-up(10 × 1.6^(L−1)); P is the permanent prestige multiplier and never changes catalogue prices. U is the sum of the active district synergies below. W, M and S contributions are additive within their own category; do not multiply every building together. Project A adds 0.30 W, 0.40 M, or 0.50 S per rank; project B adds 50% more than the same-path A rate, but costs more. Review payouts use the reviewed lesson's B(L), not the highest unlocked lesson's rate, to avoid farming the easiest cards at frontier prices.

Event weights: correct word hit 1; correct match pair 2; first completion of each matching board in a run 5; correctly completed sentence 4; first sentence-stage clear in a run 10. Set completion adds 10 × B(L) × P × (1 + U), without a path bonus. Wrong/unanswered events pay zero. A grammar stage uses the base of its stated prerequisite level. Nonrepeating first-clear bonuses reset only on prestige. Keep the existing small passive/offline component, but cap its 24-hour award to 10% of the preceding active run's earned coins and apply no W/M/S bonus; it cannot become the main way to finance the village. A first run with no active earnings receives no offline grant.

Prices: research A = 20 × B(L), build A = 60 × B(L); research B = 30 × B(L), build B = 95 × B(L). At L1 this means 200 + 600 coins for A, or 300 + 950 for B. The reference gross envelope is 180 × B(L) before prestige and village effects. This is a comparison budget, not a coin grant or an exact lesson income promise: actual income depends on set size, sentence stages, reviews and accuracy. A complete A costs 80 base-hit equivalents; B costs 125; both cost 205, above the 180 reference envelope, and the one-project plot limit still prevents owning both even when permanent bonuses make coins plentiful. Rank-2 A alone costs 144 base-hit equivalents, creating a real choice between deep investment and a new district.

The 1.6× price curve is paired with a 1.6× frontier base-reward curve. This keeps first purchases within reach at their intended level while later catalogue numbers look aspirational. Hard learning gates prevent old-content farming or a large prestige bonus from purchasing unseen districts. Examples: L5 base 66, A total 5,280; L10 base 687, A total 54,960; L15 base 7,206, A total 576,480; L20 base 75,558, A total 6,044,640; L25 base 792,282, A total 63,382,560. Prices are provisional starting values; measure median first-purchase time, optional purchases per level and relative earnings by play style before asserting campaign duration.

Research is coin-funded, immediate, and linked to demonstrated vocabulary/set progress: no second currency and no mandatory real-time wait. Opening the research card shows a learned-word/phrase example, rather than imposing another quiz or adding unseen words to the level's learning load. Chinese labels reuse taught words; for example 茶 labels the tea stall and 学校 labels the school. Long English project/research names in this document are design descriptions, not extra player-facing vocabulary. The L13 请坐 label uses already-taught 请 and 坐. No more than 20 new cards are introduced in any word or sentence stage.

Optional bridges L26 and L27 do not create extra plots. They unlock replacement projects for an existing plot of the same path, carrying their own blueprint, price and rank rules. They are never required to complete the classic 300-entry campaign or its prestige milestones. S03.0 adds six number-phrase cards using known numbers before first prestige; its future pool contains 18 combinations. It adds no vocabulary headwords.

Prestige resets the wallet, all buildings/ranks, occupied plots, research and active set collections. Retain mastery history, settings and the permanent P multiplier only. Known building plans remain visible as previews, but must meet this run's set and research prerequisites again. Use the established first prestige after L3 and later 3–7 active-day target; do not require a finished village. The prestige reward should depend on distinct run achievements with diminishing repeat farming, not coins spent or the most expensive project, so no path is mandatory. Its exact P curve and the 8–16 week campaign target remain balancing work, not validated outcomes.

Player-facing states: Preview (level not cleared); Research available; Research blocked (show exact preceding node); Blueprint owned; Foundation missing; Affordable; Save more coins; Plot occupied (compare replacement); Built; Rank locked; Dormant. A player continues to the next word set when both its learning and village milestone requirements are met. No economy button should imply that buying every item is a completion requirement.
'''

SYNERGIES=[
 {'Unlock':'L8 cleared','Name':'Shared neighbourhood','Requirement':'Own at least one active project in each of two different paths','Bonus':'+0.10 U','Purpose':'An early mixed strategy is viable'},
 {'Unlock':'L12 cleared','Name':'Specialist district','Requirement':'Own four active projects in one path, including one at rank 2','Bonus':'+0.15 U; maximum once across all paths','Purpose':'Reward depth without mandatory breadth'},
 {'Unlock':'L18 cleared','Name':'Connected town','Requirement':'Own active projects in all three paths','Bonus':'+0.15 U','Purpose':'Offer an alternative long-term mixed investment'},
 {'Unlock':'L25 cleared','Name':'Established town','Requirement':'Own eight active projects in one path OR twelve active projects across paths','Bonus':'+0.20 U; once total','Purpose':'Either a specialist or a mixed town can reach the capstone'}
]
STRATEGIES=[
 {'Style':'Trade specialist','Early route':'R01A → P01A; R02A → P02A; R03A → P03A; skip expensive alternatives','Spend choice':'Buy cheaper A projects and rank up the strongest foundations','Pays best when':'Most active earnings come from word-target play','Trade-off':'Little direct benefit to matching and sentence payouts'},
 {'Style':'Community specialist','Early route':'R01B → P01B; R02B → P02B; R04A → P04A (skip Trade research)','Spend choice':'Fewer early projects because B blueprints/builds are costly','Pays best when':'The player completes matching boards and review sets frequently','Trade-off':'Slower first purchase; cannot profit from wrong pairs or repeated clear bonuses'},
 {'Style':'Study specialist','Early route':'Save during L1–2; R03B → P03B after S03.0; R04B → P04B; R06B → P06B','Spend choice':'Save for stronger sentence contributions instead of maximizing word income','Pays best when':'The player actively plays and revisits sentence stages','Trade-off':'Weak until sentence play becomes frequent; no forced sentence speed penalties'},
 {'Style':'Mixed town','Early route':'P01A Trade; P02B Community; P03B Study, with each research chain funded','Spend choice':'Spread spending across paths and pursue Shared neighbourhood','Pays best when':'Play time is distributed across all modes','Trade-off':'Extra research costs; fewer high-ranked projects early'}
]
