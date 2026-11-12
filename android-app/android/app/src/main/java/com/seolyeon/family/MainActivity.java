package com.seolyeon.family;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** 앱 화면이 지금 보이는지 (보이면 알림 대신 앱 안에서 진동·소리) */
    public static volatile boolean foreground = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SeolyeonNativePlugin.class);
        super.onCreate(savedInstanceState);
        Notify.createChannels(this);
        SeolyeonNativePlugin.takeIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        SeolyeonNativePlugin.takeIntent(intent);
        SeolyeonNativePlugin.firePushOpen();
    }

    @Override
    public void onResume() {
        super.onResume();
        foreground = true;
        // 앱을 열면 쌓인 알림 정리
        NotificationManagerCompat.from(this).cancelAll();
    }

    @Override
    public void onPause() {
        super.onPause();
        foreground = false;
    }
}
