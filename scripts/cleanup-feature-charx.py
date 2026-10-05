import subprocess,pathlib,hashlib,json
adb=r'C:\Users\21654\AppData\Local\Android\Sdk\platform-tools\adb.exe'
expected=pathlib.Path('artifacts/features/apk-feature-card.charx').read_bytes();report=[]
directory='/sdcard/Download/000-apk-charx-verify-20261002'
for filename in ['/sdcard/Download/apk-feature-card.charx',directory+'/apk-feature-card.charx']:
    value=subprocess.run([adb,'-s','ca168055','exec-out','cat',filename],capture_output=True)
    if value.returncode!=0:continue
    assert hashlib.sha256(value.stdout).digest()==hashlib.sha256(expected).digest()
    subprocess.run([adb,'-s','ca168055','shell','rm',filename],capture_output=True,check=True);report.append(filename)
removed=subprocess.run([adb,'-s','ca168055','shell','rmdir',directory],capture_output=True).returncode==0
pathlib.Path('artifacts/features/charx-cleanup.json').write_text(json.dumps({'filesRemoved':report,'emptyDirectoryRemoved':removed},indent=2),encoding='utf-8');print(json.dumps({'filesRemoved':len(report),'emptyDirectoryRemoved':removed}))
