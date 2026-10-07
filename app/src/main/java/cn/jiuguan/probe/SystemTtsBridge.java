package cn.jiuguan.probe;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Asynchronous system TTS bridge; all entry points are restricted by MainActivity's origin check. */
final class SystemTtsBridge {
    interface Reply { void send(String id,JSONObject result,String error); }
    private final Activity activity;
    private final Reply reply;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private TextToSpeech tts;
    private String engine="",pending="",utterance="";
    private boolean ready;
    private int revision;
    private File temporary;
    private Runnable timeout;
    SystemTtsBridge(Activity activity,Reply reply){this.activity=activity;this.reply=reply;}
    private JSONArray engines() throws Exception {
        JSONArray list=new JSONArray();for(ResolveInfo info:activity.getPackageManager().queryIntentServices(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE),0)){
            if(info.serviceInfo==null||!info.serviceInfo.exported||!info.serviceInfo.enabled)continue;
            String packageName=info.serviceInfo.packageName,version="";long versionCode=0;
            try{android.content.pm.PackageInfo packageInfo=activity.getPackageManager().getPackageInfo(packageName,0);version=packageInfo.versionName==null?"":packageInfo.versionName;versionCode=Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?packageInfo.getLongVersionCode():packageInfo.versionCode;}catch(Exception ignored){}
            list.put(new JSONObject().put("package",packageName).put("label",info.loadLabel(activity.getPackageManager()).toString()).put("version",version).put("versionCode",versionCode));
        }return list;
    }
    void dispatch(JSONObject request){
        String id=request.optString("id"),action=request.optString("action");if(!id.matches("[a-zA-Z0-9-]{1,100}")){return;}
        if(action.equals("stop")){cancel("已停止系统语音生成");reply.send(id,new JSONObject(),null);return;}
        if(!pending.isEmpty()){reply.send(id,null,"系统语音正在处理另一个请求，请先停止");return;}
        if(!action.equals("detect")&&!action.equals("synthesize")){reply.send(id,null,"不支持的系统语音操作");return;}
        pending=id;final int ticket=++revision;timeout=()->{if(ticket==revision)cancel("系统语音引擎响应超时，请重新检测");};handler.postDelayed(timeout,action.equals("detect")?20000:180000);
        try{
            JSONArray installed=engines();String chosen=request.optString("engine");
            if(chosen.isEmpty()){String preferred=android.provider.Settings.Secure.getString(activity.getContentResolver(),"tts_default_synth");chosen=preferred==null?"":preferred;}
            boolean found=false;for(int i=0;i<installed.length();i++)if(installed.getJSONObject(i).getString("package").equals(chosen))found=true;
            if(!found){if(!request.optString("engine").isEmpty())throw new IOException("该语音引擎已卸载，请重新检测");chosen=installed.length()>0?installed.getJSONObject(0).getString("package"):"";}
            if(chosen.isEmpty()){finish(new JSONObject().put("engines",installed).put("voices",new JSONArray()).put("ready",false).put("error","没有检测到可用的系统语音引擎"),null);return;}
            final String selected=chosen;Runnable proceed=()->{if(ticket!=revision)return;try{if(action.equals("detect"))finish(inventory(installed),null);else synthesize(request,ticket);}catch(Exception error){finish(null,"系统语音："+error.getMessage());}};
            if(ready&&selected.equals(engine)){proceed.run();return;}
            if(tts!=null)tts.shutdown();ready=false;engine=selected;
            tts=new TextToSpeech(activity,status->handler.post(()->{if(ticket!=revision)return;if(status!=TextToSpeech.SUCCESS){try{finish(new JSONObject().put("engines",installed).put("selectedEngine",selected).put("voices",new JSONArray()).put("ready",false).put("error","引擎初始化失败，可能缺少语音数据或限制第三方访问"),action.equals("detect")?null:"系统语音引擎无法初始化");}catch(Exception e){finish(null,e.getMessage());}return;}ready=true;proceed.run();}),selected);
        }catch(Exception error){finish(null,error.getMessage());}
    }
    private JSONObject inventory(JSONArray installed)throws Exception{
        JSONArray voices=new JSONArray(),languages=new JSONArray(),features;Set<String> languageSet=new TreeSet<>(),nativeEmotions=new TreeSet<>();int localCount=0,networkCount=0;
        Set<Voice> available=tts.getVoices();if(available!=null){List<Voice> sorted=new ArrayList<>(available);sorted.sort(Comparator.comparing(Voice::getName));for(Voice voice:sorted){Set<String> voiceFeatures=voice.getFeatures();boolean network=voice.isNetworkConnectionRequired(),voiceInstalled=!voiceFeatures.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);if(network)networkCount++;else localCount++;languageSet.add(voice.getLocale().toLanguageTag());features=new JSONArray();List<String> orderedFeatures=new ArrayList<>(voiceFeatures);Collections.sort(orderedFeatures);for(String feature:orderedFeatures){features.put(feature);if(feature.matches("(?i).*(emotion|expressive|style|ssml).*"))nativeEmotions.add(feature);}voices.put(new JSONObject().put("name",voice.getName()).put("language",voice.getLocale().toLanguageTag()).put("networkRequired",network).put("installed",voiceInstalled).put("quality",voice.getQuality()).put("latency",voice.getLatency()).put("features",features));}}
        for(String language:languageSet)languages.put(language);
        Voice selected=tts.getVoice();JSONObject capabilities=new JSONObject().put("voiceSelection",voices.length()>0).put("rate",true).put("pitch",true).put("emotion",nativeEmotions.isEmpty()?"mapped":"native").put("emotionFeatures",new JSONArray(nativeEmotions)).put("localVoiceCount",localCount).put("networkVoiceCount",networkCount).put("languages",languages);
        String engineVersion="";for(int i=0;i<installed.length();i++){JSONObject item=installed.getJSONObject(i);if(item.optString("package").equals(engine)){engineVersion=item.optString("version");break;}}
        return new JSONObject().put("engines",installed).put("selectedEngine",engine).put("engineVersion",engineVersion).put("voices",voices).put("capabilities",capabilities).put("ready",true).put("defaultVoice",selected==null?"":selected.getName()).put("maxTextLength",TextToSpeech.getMaxSpeechInputLength());
    }
    private void synthesize(JSONObject request,int ticket)throws Exception{
        String text=request.optString("text").trim(),scope=request.optString("scopeId"),name=request.optString("voice");
        if(text.isEmpty()||text.length()>TextToSpeech.getMaxSpeechInputLength()||scope.isEmpty()||scope.length()>400)throw new IOException("系统语音正文为空、过长或角色卡标识无效");
        Voice chosen=null;Set<Voice> available=tts.getVoices();if(available!=null)for(Voice v:available)if(v.getName().equals(name))chosen=v;
        if(chosen==null)throw new IOException("音色已不可用，请重新检测");if(chosen.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))throw new IOException("请先在系统语音设置下载该音色数据");
        double rate=request.optDouble("rate",1),pitch=request.optDouble("pitch",1);if(!Double.isFinite(rate)||!Double.isFinite(pitch)||rate<0.5||rate>2||pitch<0.5||pitch>2)throw new IOException("语速或音高必须在 0.5 到 2 之间");
        if(tts.setVoice(chosen)!=TextToSpeech.SUCCESS||tts.setSpeechRate((float)rate)!=TextToSpeech.SUCCESS||tts.setPitch((float)pitch)!=TextToSpeech.SUCCESS)throw new IOException("引擎不支持所选音色或参数");
        JSONObject metadata=new JSONObject().put("scopeId",scope).put("engine",engine).put("voice",name).put("rate",rate).put("pitch",pitch).put("text",text).put("version",activity.getPackageManager().getPackageInfo(engine,0).versionName);
        String key=hex(MessageDigest.getInstance("SHA-256").digest(metadata.toString().getBytes(StandardCharsets.UTF_8)));File directory=new File(activity.getFilesDir(),"tavern/.android-system-tts");if(!directory.exists()&&!directory.mkdirs())throw new IOException("无法建立系统语音缓存目录");
        File audio=new File(directory,key+".wav"),info=new File(directory,key+".json");if(audio.isFile()&&audio.length()>44&&info.isFile()){long now=System.currentTimeMillis();audio.setLastModified(now);info.setLastModified(now);finish(new JSONObject().put("key",key).put("cached",true),null);return;}
        temporary=new File(directory,key+"."+UUID.randomUUID()+".tmp");final File writing=temporary;utterance=UUID.randomUUID().toString();final String current=utterance;
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
            @Override public void onStart(String id){}
            @Override public void onDone(String id){if(!current.equals(id))return;handler.post(()->{if(ticket!=revision)return;try{
                if(writing.length()<=44||writing.length()>48L*1024*1024)throw new IOException("引擎没有生成有效音频或音频超过大小限制");
                byte[] header=new byte[12];try(FileInputStream input=new FileInputStream(writing)){if(input.read(header)!=12||!new String(header,0,4,StandardCharsets.US_ASCII).equals("RIFF")||!new String(header,8,4,StandardCharsets.US_ASCII).equals("WAVE"))throw new IOException("引擎返回了不支持的音频格式");}
                if(!writing.renameTo(audio))throw new IOException("无法保存系统语音音频");File tempInfo=new File(directory,key+".json.tmp");try(FileOutputStream out=new FileOutputStream(tempInfo)){out.write(metadata.toString().getBytes(StandardCharsets.UTF_8));}if(!tempInfo.renameTo(info))throw new IOException("无法保存系统语音索引");temporary=null;finish(new JSONObject().put("key",key).put("cached",false),null);
            }catch(Exception e){finish(null,e.getMessage());}});}
            @Override public void onError(String id){onError(id,TextToSpeech.ERROR);}
            @Override public void onError(String id,int code){if(current.equals(id))handler.post(()->{if(ticket==revision)finish(null,"系统语音生成失败（"+code+"），请检查音色数据和网络");});}
        });
        if(tts.synthesizeToFile(text,new Bundle(),writing,current)!=TextToSpeech.SUCCESS)throw new IOException("该引擎不支持生成可保存的语音文件");
    }
    private static String hex(byte[] bytes){StringBuilder text=new StringBuilder();for(byte b:bytes)text.append(String.format(Locale.ROOT,"%02x",b&255));return text.toString();}
    private void finish(JSONObject result,String error){String id=pending;pending="";if(timeout!=null)handler.removeCallbacks(timeout);timeout=null;if(temporary!=null){temporary.delete();temporary=null;}if(!id.isEmpty())reply.send(id,result,error);}
    void cancel(String reason){revision++;if(tts!=null)tts.stop();finish(null,reason);}
    void close(){cancel("页面已关闭，系统语音已停止");ready=false;if(tts!=null){tts.shutdown();tts=null;}}
}
