import zipfile,json,pathlib
path=pathlib.Path('artifacts/features/apk-feature-card.charx')
card={'spec':'chara_card_v3','spec_version':'3.0','data':{'name':'APK File Selection Fixture','description':'Local file-selection verification only','personality':'','scenario':'','first_mes':'Local verification','mes_example':'','creator_notes':'','system_prompt':'','post_history_instructions':'','alternate_greetings':[],'tags':[],'creator':'local','character_version':'1','extensions':{},'assets':[]}}
with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as archive:archive.writestr('card.json',json.dumps(card))
print(json.dumps({'file':str(path),'size':path.stat().st_size}))
