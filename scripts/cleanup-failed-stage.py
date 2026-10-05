import json,re,pathlib,subprocess
adb=r'C:\Users\21654\AppData\Local\Android\Sdk\platform-tools\adb.exe';package='cn.jiuguan.probe'
record=json.loads(pathlib.Path('artifacts/features/update-prepare-status.json').read_text(encoding='utf-8'));stage=record['job']['stage'];assert re.fullmatch('staging-[0-9a-f]{16}',stage)
def run(*args,check=True):return subprocess.run([adb,'-s','ca168055','shell','run-as',package,*args],capture_output=True,check=check)
base='files/tavern/.apk-updates';target=base+'/'+stage;removed=False
if run('test','-d',target,check=False).returncode==0:
    base_real=run('realpath',base).stdout.decode().strip();target_real=run('realpath',target).stdout.decode().strip();assert target_real==base_real+'/'+stage
    assert run('test','-f',target+'/.apk-ready.json',check=False).returncode!=0
    run('rm','-rf',target);removed=True
pathlib.Path('artifacts/features/failed-stage-cleanup.json').write_text(json.dumps({'stage':stage,'removed':removed},indent=2),encoding='utf-8');print(json.dumps({'failedStageRemoved':removed}))
