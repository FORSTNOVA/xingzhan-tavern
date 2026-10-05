package cn.jiuguan.probe;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;

/** Node can initialize only once per process; keep a visible activity during restart. */
public class RestartActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView message=new TextView(this);message.setText("正在重启"+getString(R.string.app_name)+"…");message.setTextSize(20);message.setPadding(32,64,32,32);setContentView(message);
        int oldPid=getIntent().getIntExtra("oldPid",-1);
        if(oldPid>0&&oldPid!=android.os.Process.myPid())android.os.Process.killProcess(oldPid);
        new Handler(Looper.getMainLooper()).postDelayed(()->{
            startActivity(new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
            finish();
            new Handler(Looper.getMainLooper()).postDelayed(()->android.os.Process.killProcess(android.os.Process.myPid()),1000);
        },700);
    }
}
