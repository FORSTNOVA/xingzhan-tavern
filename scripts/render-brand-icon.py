"""Render the Android vector source for a desktop preview; no bitmap in the APK."""
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
NS = '{http://schemas.android.com/apk/res/android}'
source = ET.parse(ROOT / 'app/src/main/res/drawable/ic_launcher_foreground.xml').getroot()
size = 1024
art = Image.new('RGB', (size, size), '#20243F')
draw = ImageDraw.Draw(art)
svg_paths = []
for element in source:
    color, data = element.attrib[NS+'fillColor'], element.attrib[NS+'pathData']
    svg_paths.append(f'<path fill="{color}" d="{data}"/>')
    if 'A' in data:
        draw.ellipse(tuple((p-18)*size/72 for p in (27,53,31,57)), fill=color)
        continue
    tokens = re.findall(r'[MLQZ]|-?\d+(?:\.\d+)?', data)
    points, cursor, i = [], (0,0), 0
    while i < len(tokens):
        command = tokens[i]; i += 1
        if command in ('M','L'):
            cursor = tuple(float(v) for v in tokens[i:i+2]); i += 2
            points.append(cursor)
        elif command == 'Q':
            control = tuple(float(v) for v in tokens[i:i+2])
            end = tuple(float(v) for v in tokens[i+2:i+4]); i += 4
            start = cursor
            for step in range(1,33):
                t = step/32
                points.append(tuple((1-t)**2*start[j]+2*(1-t)*t*control[j]+t*t*end[j] for j in (0,1)))
            cursor = end
        elif command != 'Z':
            raise ValueError(command)
    draw.polygon([tuple((p-18)*size/72 for p in point) for point in points], fill=color)
output = ROOT / 'artifacts/branding'
output.mkdir(parents=True, exist_ok=True)
(output/'xingzhan-icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><rect x="18" y="18" width="72" height="72" fill="#20243F"/>'+''.join(svg_paths)+'</svg>', encoding='utf-8')
preview = Image.new('RGB', (1024,512), '#F0EEE9')
for index, shape in enumerate(('rounded','circle')):
    mask = Image.new('L',(size,size),0)
    painter = ImageDraw.Draw(mask)
    if shape == 'circle': painter.ellipse((0,0,size-1,size-1),fill=255)
    else: painter.rounded_rectangle((0,0,size-1,size-1),radius=240,fill=255)
    preview.paste(art.resize((416,416),Image.Resampling.LANCZOS),(index*512+48,48),mask.resize((416,416),Image.Resampling.LANCZOS))
preview.save(output/'xingzhan-icon-preview.png')
