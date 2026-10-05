"""Inject throw/exit startup fixtures into isolated app-private version directories."""
import subprocess,json,pathlib,tarfile,io,time,urllib.request
adb=r'C:\Users\21654\AppData\Local\Android\Sdk\platform-tools\adb.exe';package='cn.jiuguan.probe';statepath='files/tavern/.apk-updates/state.json'
def device(*args,input=None):return subprocess.run([adb,'-s','ca168055',*args],input=input,capture_output=True,check=True).stdout
def node(*args):return subprocess.run(['node',*args],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True,timeout=35).stdout
def readstate():return json.loads(device('exec-out','run-as',package,'cat',statepath))
def writestate(value):device('shell','run-as',package,'tee',statepath,input=json.dumps(value).encode())
def restart():
    for attempt in range(5):
        try:
            node('scripts/feature-bind.mjs');node('scripts/feature-browser.mjs','navigate','http://127.0.0.1:8788/manage');node('scripts/feature-browser.mjs','wait-management');break
        except subprocess.CalledProcessError as error:
            if attempt==4:raise RuntimeError('Restart control unavailable: '+error.stderr[:1200])
            time.sleep(.3)
    try:node('scripts/feature-browser.mjs','eval','scripts/feature-restart.js')
    except subprocess.CalledProcessError:pass
original=readstate();report=[];created=[]
try:
    for letter,source,expected in [('f',"throw new Error('APK deliberately failing update startup');",'失败'),('e','process.exit(7);','exit')]:
        commit=letter*40;relative='files/tavern/.apk-updates/releases/'+commit
        if subprocess.run([adb,'-s','ca168055','shell','run-as',package,'test','-e',relative]).returncode==0:raise RuntimeError('Fixture path already exists')
        device('shell','run-as',package,'mkdir','-p',relative);created.append(relative)
        files={'.apk-ready.json':json.dumps({'commit':commit,'testFixture':True}),'package.json':json.dumps({'type':'module','name':'sillytavern'}),'server.js':source,'src/endpoints/extensions.js':"import { CheckRepoActions, default as simpleGit } from 'simple-git';",'src/server-main.js':'setupPrivateEndpoints(app);\nfunction apply404Middleware() { }'}
        buffer=io.BytesIO()
        with tarfile.open(fileobj=buffer,mode='w') as archive:
            for name,text in files.items():
                content=text.encode();entry=tarfile.TarInfo(name);entry.size=len(content);archive.addfile(entry,io.BytesIO(content))
        device('shell','run-as',package,'tar','xf','-','-C',relative,input=buffer.getvalue())
        staged=dict(original,active=commit,previous='bundled',pending={'attempts':0,'started':int(time.time()*1000)},lastError=None);writestate(staged);restart()
        complete=False
        for attempt in range(120):
            try:
                current=readstate()
                if current['active']=='bundled' and not current.get('pending') and current.get('lastError'):
                    with urllib.request.urlopen('http://127.0.0.1:19787/',timeout=1) as response:healthy=response.status==200
                    with urllib.request.urlopen('http://127.0.0.1:19788/health',timeout=1) as response:health=json.load(response)
                    if healthy and health.get('startupError') is None:complete=True;break
            except Exception:pass
            time.sleep(.25)
        if not complete:raise RuntimeError('Automatic startup recovery did not complete: '+source)
        report.append({'fixture':'throw' if letter=='f' else 'process.exit(7)','automaticRollback':True,'active':current['active'],'serverHealthy':True,'lastError':current['lastError']})
        writestate(original);restart();node('scripts/feature-bind.mjs')
finally:
    writestate(original)
    for relative in created:
        resolved=device('shell','run-as',package,'realpath',relative).decode().strip()
        if not resolved.endswith('/'+relative) or package not in resolved:raise RuntimeError('Unsafe fixture cleanup target')
        device('shell','run-as',package,'rm','-rf',relative)
    destination=pathlib.Path('artifacts/features/update-failure-phone.json');destination.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
