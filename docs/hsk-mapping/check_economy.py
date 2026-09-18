from resource_economy import build_economy, resource_gates, RESOURCES, INFRASTRUCTURE
levels,projects,research=build_economy()
assert len(projects)==len(research)==54 and len(levels)==27
assert len(RESOURCES)==5
assert sum(r['Role']=='Construction' for r in RESOURCES)==3
nodes={r['ID']:r for r in research}
for r in research:
 assert r['Price (coins)']==0 and r['Knowledge']>0
 assert (r['Insight']>0)==(r['Level']>=8)
 if r['Previous research ID']:
  parent=nodes[r['Previous research ID']]
  assert parent['Level']<r['Level'] and parent['Path']==r['Path']
for p in projects:
 assert p['Build price (coins)']>0 and p['Timber']>0 and p['Stone']>0
 assert (p['Bricks']>0)==(p['Level']>=8)
 assert p['Research ID'] in nodes
assert all(i['First-copy coins']>0 for i in INFRASTRUCTURE)
starter=next(i for i in INFRASTRUCTURE if i['ID']=='I03')
assert starter['First-copy coins']<=250 and starter['Timber']==starter['Stone']==starter['Bricks']==0
assert next(i for i in INFRASTRUCTURE if i['ID']=='I05')['Bricks']==0
for path in ['Trade','Community','Study']:
 for gate in resource_gates():
  n=gate['Cleared level'];owned=[p for p in projects if p['Level']<=n and p['Path']==path]
  if path=='Study':owned+=[projects[0]]
  assert len(owned)>=gate['Village strength required']
  assert len(owned)>=gate['Research nodes required']
  assert any(max(1,n-4)<=p['Level']<=n for p in owned)
  assert len(owned)+(3 if n<8 else 5)<=4+n
print('PASS: five resources; 54 repeatable projects; 54 acyclic research nodes; affordable coin-only tech starter; no premature brick/insight costs; specialist routes fit basic land.')
print('Catalogue checks only; production timings still need playtesting.')
