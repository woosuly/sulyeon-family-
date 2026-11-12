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
}
