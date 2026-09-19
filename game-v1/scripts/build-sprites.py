"""Deterministic vector sprite atlas; edit paths here, then regenerate."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
icons={
 'play':'<path d="M24 18L46 32 24 46Z"/>',
 'sets':'<rect x="15" y="15" width="25" height="34" rx="3"/><path d="M44 20v30H24"/>',
 'village':'<path d="M12 31L32 13 52 31M17 29v23h30V29M28 52V36h9v16M10 31h44"/>',
 'tech':'<path d="M15 18q9-5 17 1 8-6 17-1v31q-8-5-17 0-8-5-17 0ZM32 19v30M21 26h6M37 26h6M21 33h6M37 33h6"/>',
 'timber':'<rect x="9" y="16" width="46" height="13" rx="4" fill="#bd864b"/><rect x="9" y="35" width="46" height="13" rx="4" fill="#d5a963"/><path d="M16 22h17m7 0h8M16 41h8m7 0h17" fill="none" stroke="#79522f"/>',
 'stone':'<path d="M8 46v-8l7-7h15l7 9v8H10z" fill="#8b9c88"/><path d="M34 48V36l6-7h10l7 9v10z" fill="#a5b29a"/><path d="M20 25v-8l7-7h12l7 9v6z" fill="#c0c9ad"/>',
 'bricks':'<rect x="8" y="13" width="48" height="38" rx="3" fill="#bc7853"/><path d="M9 26h46M9 39h46M24 14v12M42 14v12M18 26v13M38 26v13M27 39v11M46 39v11" fill="none" stroke="#f7e6b8" stroke-width="3"/>',
 'knowledge':'<path d="M8 15q12-5 24 1 12-6 24-1v36q-12-5-24 0-12-5-24 0z" fill="#fff0c4"/><path d="M32 16v35M15 24h10M15 31h10M15 38h10M39 24h10M39 31h10M39 38h7" fill="none"/>',
 'insight':'<path d="M32 8v7M23 15h18M23 49h18M32 50v8" fill="none"/><rect x="16" y="19" width="32" height="27" rx="9" fill="#e1b84f"/><path d="M27 20v25M37 20v25M11 27H6M53 27h5" fill="none" stroke="#8d6b30"/>',
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
