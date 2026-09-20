"""Build small PNG/ICO companions for the vector coin favicon, then wire pages."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SCALE=8
canvas=Image.new('RGBA',(64*SCALE,64*SCALE))
draw=ImageDraw.Draw(canvas)
def box(coords):return tuple(round(x*SCALE) for x in coords)
draw.rounded_rectangle(box((0,0,64,64)),radius=14*SCALE,fill='#164c3b')
draw.ellipse(box((9,11,55,57)),fill='#8f682c')
draw.ellipse(box((9,7,55,53)),fill='#e4b956')
draw.ellipse(box((14,12,50,48)),outline='#fff0b4',width=2*SCALE)
draw.rectangle(box((24,22,40,38)),fill='#164c3b',outline='#a67729',width=2*SCALE)
draw.line([box((25,38)),box((40,38)),box((40,23))],fill='#fff0b4',width=2*SCALE)
canvas.resize((180,180),Image.Resampling.LANCZOS).save(ROOT/'assets/apple-touch-icon.png')
canvas.resize((32,32),Image.Resampling.LANCZOS).save(ROOT/'assets/favicon-32.png')
canvas.resize((64,64),Image.Resampling.LANCZOS).save(ROOT/'assets/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
for page in [ROOT/'index.html',ROOT/'document.html',*(ROOT/'screens').glob('*.html')]:
 prefix='../assets/' if page.parent.name=='screens' else 'assets/'
 links=f'<link rel="icon" href="{prefix}favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="{prefix}favicon.svg"><link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">'
 text=page.read_text(encoding='utf-8')
 if 'favicon.svg' not in text:text=text.replace('</title>','</title>'+links,1)
 page.write_text(text,encoding='utf-8')
print('Built coin favicon and linked all game pages.')
