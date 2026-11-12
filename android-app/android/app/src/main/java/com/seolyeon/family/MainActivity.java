package com.seolyeon.family;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
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
        fitSystemBars();
    }

    /**
     * 화면 끝까지 그리는 안드로이드 15에서:
     * - 아래 내비게이션 바·키보드 높이만큼 웹화면을 줄임 (겹침 방지, 키보드 열리면 화면이 키보드 위로 맞춰짐)
     * - 위 상태바는 웹(CSS safe-area)이 처리하도록 상태바 높이만 넘김
     */
    private void fitSystemBars() {
        View wv = getBridge().getWebView();
        View parent = (View) wv.getParent();
        parent.setBackgroundColor(0xFF2B3A55);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(false);
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, wi) -> {
            Insets nav = wi.getInsets(WindowInsetsCompat.Type.navigationBars());
            Insets ime = wi.getInsets(WindowInsetsCompat.Type.ime());
            Insets top = wi.getInsets(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = nav.left;
            mlp.rightMargin = nav.right;
            mlp.bottomMargin = Math.max(nav.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            WindowInsetsCompat pass = new WindowInsetsCompat.Builder()
                .setInsets(WindowInsetsCompat.Type.statusBars(), Insets.of(0, top.top, 0, 0))
                .build();
            return ViewCompat.onApplyWindowInsets(v, pass);
        });
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
