package com.seolyeon.family;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 받는 대화방에 카톡이 오면 "읽어드릴까요?" 팝업.
 *  - 설연 화면이 열려 있으면: 웹화면에 팝업 (말로 "네" 하면 읽음)
 *  - 닫혀 있거나 화면이 꺼져 있으면: 소리 없는 팝업 알림 + [읽어주기] 버튼
 *  - 밤 10시 ~ 아침 7시는 묻지 않음. 설정에서 끌 수 있음
 *  - 내용은 폰 메모리에만 잠깐 두고 읽으면 지움 (저장·전송 안 함)
 */
public class KakaoAsk {
    static final String CH = "kakao_ask";
    static final String ACT_READ = "com.seolyeon.family.KAKAO_READ", ACT_CLEAR = "com.seolyeon.family.KAKAO_CLEAR";
    private static final Map<String, List<String[]>> pend = new LinkedHashMap<>();
    private static TextToSpeech tts;
    private static boolean ready;
    private static final List<String> queue = new ArrayList<>();

    static boolean on(Context c) { return c.getSharedPreferences("kakao_rooms", Context.MODE_PRIVATE).getBoolean("ask", true); }
    static void setOn(Context c, boolean v) { c.getSharedPreferences("kakao_rooms", Context.MODE_PRIVATE).edit().putBoolean("ask", v).apply(); }

    /** 문자: 연락처에 저장된 사람(알림 제목이 이름)만. 대화방 이름은 "문자 · 이름" */
    static final String SMS = "문자 · ";
    static void incomingSms(Context c, String from, String text) {
        if (from == null || from.isEmpty() || from.matches("^[\\d+\\-\\s()#]{3,}$") || text == null) return;   // 번호만 보이면 모르는 사람
        if (text.contains("광고") || text.contains("[Web발신]") || text.contains("수신거부") || text.contains("무료거부") || CardQueue.isSecret(text) || CardQueue.looksCard(text)) return;
        incoming(c, SMS + from, from, text);
    }
    static synchronized void incoming(Context c, String room, String from, String text) {
        if (!on(c) || text == null || text.trim().isEmpty()) return;
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        if (h >= 22 || h < 7) return;
        List<String[]> l = pend.get(room);
        if (l == null) { l = new ArrayList<>(); pend.put(room, l); }
        // 카톡이 같은 알림을 다시 올리는 경우 중복 제외
        if (!l.isEmpty() && l.get(l.size() - 1)[1].equals(text) && l.get(l.size() - 1)[0].equals(from == null ? "" : from)) return;
        l.add(new String[]{from == null ? "" : from, text});
        while (l.size() > 10) l.remove(0);
        if (MainActivity.foreground && SeolyeonNativePlugin.fireKakaoIn(room, from, text, l.size())) return;
        post(c, room, l);
    }

    private static void post(Context c, String room, List<String[]> l) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CH) == null) {
                NotificationChannel ch = new NotificationChannel(CH, "카톡 읽어드릴까요?", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("받는 대화방에 카톡이 오면 읽어 줄지 묻는 팝업 (소리 없음)");
                ch.setSound(null, null);
                ch.enableVibration(false);
                nm.createNotificationChannel(ch);
            }
        }
        int req = room.hashCode();
        Intent read = new Intent(c, KakaoAskReceiver.class).setAction(ACT_READ).putExtra("room", room);
        Intent clear = new Intent(c, KakaoAskReceiver.class).setAction(ACT_CLEAR).putExtra("room", room);
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("push_k", "kakao").putExtra("push_id", room);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        NotificationCompat.InboxStyle st = new NotificationCompat.InboxStyle();
        for (String[] m : l) st.addLine((room.equals(m[0]) || room.equals(SMS + m[0]) ? "" : m[0] + ": ") + m[1]);
        String last = l.get(l.size() - 1)[1];
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_stat_notify).setColor(0xFF2B3A55)
                .setContentTitle((room.startsWith(SMS) ? "✉️ " : "💬 ") + room + (l.size() > 1 ? " (" + l.size() + ")" : "") + " · 읽어드릴까요?")
                .setContentText(last).setStyle(st)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setOnlyAlertOnce(false).setAutoCancel(true).setTimeoutAfter(10 * 60 * 1000)
                .setContentIntent(PendingIntent.getActivity(c, req, open, f))
                .addAction(0, "읽어주기", PendingIntent.getBroadcast(c, req, read, f))
                .addAction(0, "괜찮아요", PendingIntent.getBroadcast(c, req + 1, clear, f));
        try { NotificationManagerCompat.from(c).notify("kakao-" + room, 2, b.build()); } catch (SecurityException ignored) { }
    }

    /** 읽을 말 만들기 (읽은 건 지움) */
    static synchronized String take(String room) {
        List<String[]> l = pend.remove(room);
        if (l == null || l.isEmpty()) return "";
        StringBuilder s = new StringBuilder();
        boolean sms = room.startsWith(SMS), one = true;
        for (String[] m : l) if (!room.equals(m[0]) && !(sms && room.equals(SMS + m[0]))) one = false;
        s.append(sms ? room.substring(SMS.length()) + "님 문자입니다. " : one ? room + "님 카톡입니다. " : room + " 방 카톡입니다. ");
        String prev = "";
        for (String[] m : l) {
            if (!one && !m[0].equals(prev)) s.append(m[0]).append("님, ");
            s.append(m[1]).append(". ");
            prev = m[0];
        }
        return s.toString();
    }
    static synchronized void clear(String room) { pend.remove(room); }
    static synchronized int count(String room) { List<String[]> l = pend.get(room); return l == null ? 0 : l.size(); }

    static void read(Context c, String room) {
        cancel(c, room);
        String s = take(room);
        if (!s.isEmpty()) speak(c, s);
    }
    static void cancel(Context c, String room) { try { NotificationManagerCompat.from(c).cancel("kakao-" + room, 2); } catch (Exception ignored) { } }

    static synchronized void speak(Context c, String s) {
        if (tts == null) {
            queue.add(s);
            tts = new TextToSpeech(c.getApplicationContext(), status -> {
                synchronized (KakaoAsk.class) {
                    ready = status == TextToSpeech.SUCCESS;
                    if (ready) { tts.setLanguage(Locale.KOREAN); for (String q : queue) tts.speak(q, TextToSpeech.QUEUE_ADD, null, "kk" + q.hashCode()); }
                    queue.clear();
                }
            });
            return;
        }
        if (ready) tts.speak(s, TextToSpeech.QUEUE_ADD, null, "kk" + s.hashCode()); else queue.add(s);
    }
    static void stop() { if (tts != null && ready) tts.stop(); }
}
