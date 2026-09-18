"""Deterministic vector sprite atlas; edit paths here, then regenerate."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
icons={
 'play':'<path d="M24 18L46 32 24 46Z"/>',
 'sets':'<rect x="15" y="15" width="25" height="34" rx="3"/><path d="M44 20v30H24"/>',
 'village':'<path d="M12 31L32 13 52 31M17 29v23h30V29M28 52V36h9v16M10 31h44"/>',
 'tech':'<path d="M15 18q9-5 17 1 8-6 17-1v31q-8-5-17 0-8-5-17 0ZM32 19v30M21 26h6M37 26h6M21 33h6M37 33h6"/>',
 'timber':'<path d="M15 39L40 15q14 0 10 14L26 53Z"/><ellipse cx="21" cy="45" rx="8" ry="9"/><path d="M21 41v8M29 35l15-15"/>',
 'stone':'<path d="M11 39L20 20 40 15 53 34 44 49 22 51ZM20 20l8 17-6 14M28 37l25-3M28 37l12-22"/>',
 'bricks':'<path d="M10 27L35 16 54 26 29 39ZM10 27v15l19 12 25-13V26M29 39v15M23 22l20 11"/>',
 'knowledge':'<path d="M19 14h26v36H19q-8-6 0-10h26M22 24h16M22 31h13M19 14v26"/>',
 'insight':'<path d="M25 43c0-8-10-12-6-23 5-14 24-10 26 0 3 12-6 15-6 23ZM25 48h14M28 53h8M32 5V1M11 12l-5-5M53 12l5-5"/>',
 'coins':'<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="17"/><path d="M26 26h12v12H26Z"/>',
 'memory':'<rect x="11" y="15" width="23" height="34" rx="4"/><rect x="30" y="19" width="23" height="34" rx="4"/><path d="M19 26l5 8-5 8M39 29h7v13h-7"/>',
 'storage':'<path d="M12 23h40v30H12ZM8 15h48v9H8ZM25 30h14v7H25Z"/>',
 'cardback':'<path d="M32 10L50 32 32 54 14 32ZM32 19L42 32 32 45 22 32ZM17 12h-7v7M47 12h7v7M17 52h-7v-7M47 52h7v-7"/>'}
sheet='<svg xmlns="http://www.w3.org/2000/svg" width="'+str(len(icons)*64)+'" height="64" viewBox="0 0 '+str(len(icons)*64)+' 64">'
for i,paths in enumerate(icons.values()):sheet+=f'<g transform="translate({i*64})" fill="#dbb85d" stroke="#184d3d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{paths}</g>'
(ROOT/'assets/ui-sprites.svg').write_text(sheet+'</svg>',encoding='utf-8')
css='.sprite{display:inline-block;flex:none;width:32px;height:32px;background-image:url("./assets/ui-sprites.svg");background-repeat:no-repeat;background-size:'+str(len(icons)*32)+'px 32px;vertical-align:middle}\n'
for i,name in enumerate(icons):css+=f'.sprite-{name}{{background-position:{-i*32}px 0}}\n'
(ROOT/'sprites.css').write_text(css,encoding='utf-8')
print('Built',len(icons),'atlas cells.')
