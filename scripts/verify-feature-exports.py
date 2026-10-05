import pathlib,json,hashlib
from PIL import Image
directory=pathlib.Path('artifacts/features')
value=json.loads((directory/'exported-test.json').read_text(encoding='utf-8'))
assert value=={'androidExport':True,'text':'中文保存验证'}
with Image.open(directory/'exported-test.png') as image:assert image.size==(64,64) and image.format=='PNG'
report={name:{'size':(directory/name).stat().st_size,'sha256':hashlib.sha256((directory/name).read_bytes()).hexdigest()} for name in ['exported-test.json','exported-test.png']}
(directory/'exports-verified.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'json':True,'png':True}))
