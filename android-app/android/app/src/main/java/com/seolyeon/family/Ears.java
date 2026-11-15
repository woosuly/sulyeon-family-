package com.seolyeon.family;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;

/**
 * 설연 듣기 (폰 음성 인식 직접 사용)
 *  - 말하는 동안 글자가 바로 보이게 중간 결과를 보냄
 *  - 폰 인식기는 1~2초만 쉬어도 끝내 버림 → 결과가 나오면 곧바로 다시 들어 이어 붙임
 *    다시 들을 때 2초 안에 말이 시작되지 않으면 말이 끝난 것으로 보고 마침
 *  - 결과는 이벤트로: start / partial(text) / final(text) / end / error(err)
 */
public class Ears {
    interface Out { void emit(String type, String text, String err, int sid); }

    private final Context ctx; private final Out out;
    private final Handler h = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr; private String acc = "", lang = "ko-KR";
    private boolean stopReq = false, running = false, spoke = false; private int round = 0, sid = 0, busyRetry = 0; private long startAt = 0;
    private final Runnable noSpeech = () -> finish();
    private final Runnable hardStop = () -> { stopReq = true; try { if (sr != null) sr.stopListening(); } catch (Exception ignored) { } h.postDelayed(this::finish, 2000); };

    Ears(Context c, Out o) { ctx = c.getApplicationContext(); out = o; }

    void start(String language, int id) {
        h.post(() -> {
            if (running) cleanup();
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { out.emit("error", "", "not-allowed", id); out.emit("end", "", "", id); return; }
            if (!SpeechRecognizer.isRecognitionAvailable(ctx)) { out.emit("error", "", "unavailable", id); out.emit("end", "", "", id); return; }
            sid = id; lang = language == null || language.isEmpty() ? "ko-KR" : language; acc = ""; stopReq = false; round = 0; busyRetry = 0; running = true; startAt = System.currentTimeMillis();
            h.postDelayed(hardStop, 60000);   // 한 번에 최대 1분
            listen();
            out.emit("start", "", "", sid);
        });
    }
    void stop() { h.post(() -> { if (!running) return; stopReq = true; h.removeCallbacks(noSpeech); try { if (sr != null) sr.stopListening(); } catch (Exception ignored) { } h.postDelayed(this::finish, 2000); }); }
    void abort() { h.post(() -> { if (!running) return; acc = ""; finish(); }); }

    private Intent intent() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.getPackageName());
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        return i;
    }
    private void listen() {
        try { if (sr != null) sr.destroy(); } catch (Exception ignored) { }
        spoke = false;
        sr = SpeechRecognizer.createSpeechRecognizer(ctx);
        sr.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { if (round > 0) h.postDelayed(noSpeech, 2000); }   // 이어 듣기: 2초 안에 말이 없으면 끝
            @Override public void onBeginningOfSpeech() { spoke = true; h.removeCallbacks(noSpeech); }
            @Override public void onRmsChanged(float v) { }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int t, Bundle b) { }
            @Override public void onPartialResults(Bundle b) {
                String t = first(b); if (t.isEmpty()) return;
                h.removeCallbacks(noSpeech); spoke = true;
                out.emit("partial", join(acc, t), "", sid);
            }
            @Override public void onResults(Bundle b) {
                h.removeCallbacks(noSpeech);
                String t = first(b); if (!t.isEmpty()) { acc = join(acc, t); out.emit("partial", acc, "", sid); }
                if (stopReq || round >= 8 || t.isEmpty()) { finish(); return; }
                round++; listen();
            }
            @Override public void onError(int e) {
                h.removeCallbacks(noSpeech);
                if (!running) return;
                // 빅스비·다른 앱이 마이크를 막 놓는 중이면 처음 몇 초 동안 바로 실패함 → 말을 시작하기 전이면 0.5초 뒤 다시 (최대 4번, 4초 안)
                boolean early = acc.isEmpty() && !spoke && round == 0 && !stopReq && System.currentTimeMillis() - startAt < 4000;
                boolean micBusy = e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == SpeechRecognizer.ERROR_CLIENT || e == SpeechRecognizer.ERROR_AUDIO
                        || e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
                if (early && micBusy && busyRetry < 4) {
                    busyRetry++; try { sr.cancel(); } catch (Exception ignored) { } h.postDelayed(() -> { if (running) listen(); }, 500); return;
                }
                if (!acc.isEmpty()) { finish(); return; }
                String err = e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "not-allowed"
                        : (e == SpeechRecognizer.ERROR_NETWORK || e == SpeechRecognizer.ERROR_NETWORK_TIMEOUT || e == SpeechRecognizer.ERROR_SERVER) ? "network" : "no-speech";
                out.emit("error", "", err, sid); finish();
            }
        });
        sr.startListening(intent());
    }
    private void finish() {
        if (!running) return;
        String t = acc; int id = sid;
        cleanup();
        if (!t.isEmpty()) out.emit("final", t, "", id);
        out.emit("end", "", "", id);
    }
    private void cleanup() {
        running = false; h.removeCallbacks(noSpeech); h.removeCallbacks(hardStop);
        try { if (sr != null) { sr.cancel(); sr.destroy(); } } catch (Exception ignored) { }
        sr = null;
    }
    private static String first(Bundle b) {
        ArrayList<String> m = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return m == null || m.isEmpty() || m.get(0) == null ? "" : m.get(0).trim();
    }
    private static String join(String a, String b) { return a.isEmpty() ? b : b.isEmpty() ? a : a + " " + b; }
}
