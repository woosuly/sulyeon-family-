package com.seolyeon.family;

import android.content.Context;
import android.content.Intent;
import android.speech.tts.TextToSpeech;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.core.content.ContextCompat;
import android.graphics.Color;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/** 알림이 잘 오도록 휴대폰 설정 화면을 열어 주는 기능 */
@CapacitorPlugin(name = "SeolyeonNative")
public class SeolyeonNativePlugin extends Plugin {
    private static SeolyeonNativePlugin instance;
    private static String pendK = null, pendId = null;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void load() {
        instance = this;
        tts = new TextToSpeech(getContext(), status -> ttsReady = status == TextToSpeech.SUCCESS);
    }

    /** 알림을 눌러 앱이 열렸을 때 어떤 화면인지 기억 */
    static void takeIntent(Intent i) {
        if (i == null) return;
        String k = i.getStringExtra("push_k");
        if (k == null || k.isEmpty()) return;
        pendK = k;
        pendId = i.getStringExtra("push_id");
        i.removeExtra("push_k");
    }

    /** 앱이 이미 열려 있을 때 알림을 누르면 화면에 바로 알림 */
    static void firePushOpen() {
        if (instance == null || pendK == null) return;
        JSObject r = new JSObject();
        r.put("k", pendK);
        r.put("id", pendId == null ? "" : pendId);
        pendK = null;
        pendId = null;
        instance.notifyListeners("pushOpen", r, true);
    }

    /** 앱이 처음 열릴 때 알림으로 열렸는지 확인 (한 번만) */
    @PluginMethod
    public void takeLaunchPush(PluginCall call) {
        JSObject r = new JSObject();
        if (pendK != null) {
            r.put("k", pendK);
            r.put("id", pendId == null ? "" : pendId);
            pendK = null;
            pendId = null;
        }
        call.resolve(r);
    }

    /** 글을 소리로 읽기 */
    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "ko-KR");
        Float rate = call.getFloat("rate", 0.9f);
        if (tts == null || !ttsReady) {
            call.reject("not ready");
            return;
        }
        tts.setLanguage(Locale.forLanguageTag(lang));
        tts.setSpeechRate(rate);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "hs");
        call.resolve();
    }

    @PluginMethod
    public void stopSpeak(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    /** 시험 알림 */
    @PluginMethod
    public void testNotify(PluginCall call) {
        Map<String, String> d = new HashMap<>();
        d.put("k", "test");
        d.put("title", "설연");
        d.put("body", "알림 시험입니다. 화면 위에 이렇게 뜨면 정상이에요.");
        d.put("tag", "test");
        Notify.show(getContext(), d);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) tts.shutdown();
        super.handleOnDestroy();
    }

    /** 절전(배터리 최적화) 예외 여부 */
    @PluginMethod
    public void batteryStatus(PluginCall call) {
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject r = new JSObject();
        r.put("ignoring", ignoring);
        call.resolve(r);
    }

    /** 절전 예외 요청 창 */
    @PluginMethod
    public void requestIgnoreBattery(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            openAppDetails();
            call.resolve();
        }
    }

    /** 알림 설정 화면 (channel 값이 있으면 그 알림 종류 화면) */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent i;
            String channel = call.getString("channel");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (channel != null) {
                    i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                    i.putExtra(Settings.EXTRA_CHANNEL_ID, channel);
                } else {
                    i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                }
                i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } else {
                openAppDetails();
            }
            call.resolve();
        } catch (Exception e) {
            openAppDetails();
            call.resolve();
        }
    }

    /** 앱 정보 화면 */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        openAppDetails();
        call.resolve();
    }

    private void openAppDetails() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }

    /** Google 로그인 (앱 안 웹화면에서는 Google 로그인 페이지가 막혀 있어 안드로이드 기본 로그인 창 사용) */
    @PluginMethod
    public void googleSignIn(PluginCall call) {
        String cid = call.getString("clientId");
        if (cid == null || cid.isEmpty()) { call.reject("clientId 없음"); return; }
        GetSignInWithGoogleOption opt = new GetSignInWithGoogleOption.Builder(cid).build();
        GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(opt).build();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.getCredentialAsync(getActivity(), req, null, ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse r) {
                    Credential c = r.getCredential();
                    if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        try {
                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(((CustomCredential) c).getData());
                            JSObject o = new JSObject();
                            o.put("idToken", g.getIdToken());
                            call.resolve(o);
                        } catch (Exception e) { call.reject("토큰 읽기 실패: " + e.getMessage()); }
                    } else call.reject("Google 계정 정보가 아님");
                }
                @Override
                public void onError(GetCredentialException e) { call.reject(e.getType() + " " + e.getMessage()); }
            });
    }

    /** 상태바·내비게이션 바 영역 색 (웹 테마 색에 맞춤) */
    @PluginMethod
    public void setBars(PluginCall call) {
        String c = call.getString("color");
        getActivity().runOnUiThread(() -> {
            try {
                int col = Color.parseColor(c);
                View wv = getBridge().getWebView();
                ((View) wv.getParent()).setBackgroundColor(col);
                double lum = (0.299 * Color.red(col) + 0.587 * Color.green(col) + 0.114 * Color.blue(col)) / 255.0;
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView());
                ic.setAppearanceLightStatusBars(lum > 0.6);
                ic.setAppearanceLightNavigationBars(lum > 0.6);
                call.resolve();
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }
}
