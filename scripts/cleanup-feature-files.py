import subprocess,pathlib,hashlib,json
adb=r'C:\Users\21654\AppData\Local\Android\Sdk\platform-tools\adb.exe'
fixtures={'/sdcard/酒馆验证.json':'exported-test.json','/sdcard/酒馆验证_1.json':'exported-test.json','/sdcard/酒馆验证.png':'exported-test.png','/sdcard/Download/apk-feature-fixture.png':'exported-test.png'}
report=[]
for filename,reference in fixtures.items():
    expected=(pathlib.Path('artifacts/features')/reference).read_bytes()
    result=subprocess.run([adb,'-s','ca168055','exec-out','cat',filename],capture_output=True)
    if result.returncode!=0:continue
    if hashlib.sha256(result.stdout).digest()!=hashlib.sha256(expected).digest():report.append({'file':filename,'removed':False,'reason':'content changed'});continue
    assert filename.startswith('/sdcard/') and filename in fixtures
    subprocess.run([adb,'-s','ca168055','shell','rm',filename],check=True,capture_output=True)
    report.append({'file':filename,'removed':True})
pathlib.Path('artifacts/features/cleanup.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'removed':sum(row['removed'] for row in report)}))
