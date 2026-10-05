"""Hash persistent files without saving or printing their contents."""
import subprocess, tarfile, io, hashlib, json, pathlib, sys
adb=r'C:\Users\21654\AppData\Local\Android\Sdk\platform-tools\adb.exe'
result=subprocess.run([adb,'-s','ca168055','exec-out','run-as','cn.jiuguan.probe','tar','cf','-','files/tavern/data','files/tavern/config.yaml'],capture_output=True,check=True)
hashes={}
with tarfile.open(fileobj=io.BytesIO(result.stdout)) as archive:
    for member in archive:
        if member.isfile() and (member.name.endswith('config.yaml') or any('/'+kind+'/' in member.name for kind in ['characters','chats','group chats','groups','extensions','worlds','themes','user','personas']) or member.name.endswith(('settings.json','secrets.json'))):
            hashes[member.name]={'size':member.size,'sha256':hashlib.sha256(archive.extractfile(member).read()).hexdigest()}
destination=pathlib.Path(sys.argv[1]);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(hashes,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(hashes),'snapshot':str(destination)},ensure_ascii=False))
