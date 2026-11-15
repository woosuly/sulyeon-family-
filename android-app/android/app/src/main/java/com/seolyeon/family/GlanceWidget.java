package com.seolyeon.family;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * 설연 한눈에 (홈 화면 위젯)
 *  - 위: 날씨(아이콘·기온·동네) + 시계·날짜 — 날씨는 앱이 보낸 값, 30분 넘으면 위젯이 Open-Meteo에서 직접 받음
 *  - 배경: 낮 블루 / 밤 네이비 그라데이션
 *  - 큰 줄: 지금 가장 중요한 한 가지 — 2시간 안 일정 > 답장 대기 > 오늘 챙길 것 > 다음 일정
 *  - 4×2(기본): 아랫줄 바로가기 [일정] [가계부(확인 대기 수)] + 마이크 / 더 높이면 다음 일정
 *  - 4×1: 오른쪽 마이크만
 *  - 마이크: 바로 듣기 시작 / 나머지: 앱 열기
 *  앱(js/features/widget.js)이 SeolyeonNative.widgetSet 으로 후보 목록을 넣고, 고르기·남은 시간은 여기서 매번 계산
 *  후보: {text, at(시각 ms, 없으면 0), until(이때까지 보임), p(1 가장 급함 ~ 9), k(누르면 열 화면)}
 */
public class GlanceWidget extends AppWidgetProvider {
    static final String PREF = "widget";

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(c, m, id);
        JSONObject w = wx(c); double lat = w.optDouble("lat", Double.NaN), lon = w.optDouble("lon", Double.NaN);
        if (Double.isNaN(lat) || Double.isNaN(lon) || System.currentTimeMillis() - w.optLong("at", 0) < 25 * 60000L) return;
        final PendingResult pr = goAsync(); final Context ac = c.getApplicationContext();
        new Thread(() -> {
            try {
                java.net.HttpURLConnection h = (java.net.HttpURLConnection) new java.net.URL("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current=temperature_2m,weather_code,is_day&timezone=auto").openConnection();
                h.setConnectTimeout(8000); h.setReadTimeout(8000);
                java.io.InputStream in = h.getInputStream(); java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[4096]; int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close();
                JSONObject cur = new JSONObject(bo.toString("UTF-8")).getJSONObject("current");
                w.put("t", cur.getDouble("temperature_2m")).put("c", cur.optInt("weather_code", 0)).put("day", cur.optInt("is_day", 1)).put("at", System.currentTimeMillis());
                ac.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putString("wx", w.toString()).apply();
                refreshAll(ac);
            } catch (Exception ignored) { } finally { pr.finish(); }
        }).start();
    }

    static JSONObject wx(Context c) {
        try { return new JSONObject(c.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("wx", "{}")); } catch (Exception e) { return new JSONObject(); }
    }
    static String wxDesc(int c) { return c <= 0 ? "맑음" : c <= 2 ? "구름 조금" : c == 3 ? "흐림" : c <= 48 ? "안개" : c <= 67 ? "비" : c <= 77 ? "눈" : c <= 82 ? "소나기" : c <= 86 ? "눈" : "뇌우"; }
    static int wxIcon(int c, boolean day) {
        if (c <= 1) return day ? R.drawable.ic_wx_sun : R.drawable.ic_wx_moon;
        if (c <= 48) return R.drawable.ic_wx_cloud;
        if ((c >= 71 && c <= 77) || c == 85 || c == 86) return R.drawable.ic_wx_snow;
        return R.drawable.ic_wx_rain;
    }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { render(c, m, id); }

    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, GlanceWidget.class))) render(c, m, id);
    }

    private static String rel(long at, long now) {
        long min = (at - now) / 60000;
        if (min < -1) return "진행 중";
        if (min <= 1) return "지금";
        if (min < 60) return min + "분 뒤";
        Calendar a = Calendar.getInstance(), b = Calendar.getInstance(); a.setTimeInMillis(at); b.setTimeInMillis(now);
        if (a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)) return (min / 60) + "시간 뒤";
        return "";
    }
    private static String withRel(JSONObject o, long now) {
        long at = o.optLong("at", 0); String r = at > 0 ? rel(at, now) : "";
        return o.optString("text") + (r.isEmpty() ? "" : "  ·  " + r);
    }

    static void render(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_glance);
        long now = System.currentTimeMillis();
        String raw = c.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("data", "{}");
        String wx = "", empty = "오늘 챙길 일은 없어요 · 말로 맡겨 주세요";
        int cards = 0;
        List<JSONObject> items = new ArrayList<>();
        try {
            JSONObject d = new JSONObject(raw); wx = d.optString("wx", ""); empty = d.optString("empty", empty); cards = d.optInt("cards", 0);
            JSONArray a = d.optJSONArray("items");
            for (int i = 0; a != null && i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i); long until = o.optLong("until", 0), at = o.optLong("at", 0);
                if (until > 0 && until < now) continue;
                if (at > 0 && at - now <= 2 * 3600e3 && at > now - 30 * 60e3) o.put("p", 1);   // 2시간 안 일정이 가장 먼저
                items.add(o);
            }
        } catch (Exception ignored) { }
        items.sort((x, y) -> { int p = Integer.compare(x.optInt("p", 9), y.optInt("p", 9)); if (p != 0) return p; long ax = x.optLong("at", Long.MAX_VALUE), ay = y.optLong("at", Long.MAX_VALUE); return Long.compare(ax == 0 ? Long.MAX_VALUE : ax, ay == 0 ? Long.MAX_VALUE : ay); });

        // 날씨 · 낮밤 배경 (앱이 보낸 값 또는 위젯이 30분마다 받은 값; 3시간 넘으면 기온은 숨김)
        JSONObject w = wx(c); boolean fresh = w.has("t") && now - w.optLong("at", 0) < 3 * 3600000L;
        int hr = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        boolean day = fresh && w.has("day") ? w.optInt("day", 1) == 1 : hr >= 7 && hr < 18;
        v.setInt(R.id.w_root, "setBackgroundResource", day ? R.drawable.wg_bg_day : R.drawable.wg_bg_night);
        int code = w.optInt("c", 0); String city = w.optString("city", "");
        v.setImageViewResource(R.id.w_wx_ic, fresh ? wxIcon(code, day) : (day ? R.drawable.ic_wx_sun : R.drawable.ic_wx_moon));
        v.setTextViewText(R.id.w_temp, fresh ? Math.round(w.optDouble("t")) + "°" : "");
        v.setTextViewText(R.id.w_place, fresh ? (city.isEmpty() ? "" : city + " · ") + wxDesc(code) : city);
        String date = new SimpleDateFormat("M.d E", Locale.KOREAN).format(now);
        String sm = fresh ? Math.round(w.optDouble("t")) + "° " + wxDesc(code) : wx;
        v.setTextViewText(R.id.w_top, sm.isEmpty() ? date : date + "  ·  " + sm);
        JSONObject head = items.isEmpty() ? null : items.get(0);
        v.setTextViewText(R.id.w_main, head == null ? empty : withRel(head, now));

        // 높이에 따라: 4×1 → 오른쪽 마이크만 / 4×2 → 아랫줄 바로가기 / 더 높으면 다음 일정 1~2개 (시각 있는 것, 머리 줄 제외)
        Bundle op = m.getAppWidgetOptions(id); int h = op == null ? 0 : op.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        boolean bar = h == 0 || h >= 100;
        for (int vid : new int[]{R.id.w_bar, R.id.w_wx, R.id.w_gap, R.id.w_div}) v.setViewVisibility(vid, bar ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_mic_s, bar ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.w_top, bar ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_badge, cards > 99 ? "99+" : String.valueOf(cards));
        v.setViewVisibility(R.id.w_badge, cards > 0 ? View.VISIBLE : View.GONE);
        List<JSONObject> next = new ArrayList<>();
        for (JSONObject o : items) if (o != head && o.optLong("at", 0) > now - 30 * 60e3 && o.optLong("at", 0) > 0) next.add(o);
        next.sort((x, y) -> Long.compare(x.optLong("at"), y.optLong("at")));
        int lines = next.isEmpty() ? 0 : bar ? (h >= 260 ? 2 : h >= 225 ? 1 : 0) : 0;
        v.setViewVisibility(R.id.w_more, lines > 0 ? View.VISIBLE : View.GONE);
        if (lines > 0) {
            v.setTextViewText(R.id.w_l1, withRel(next.get(0), now));
            boolean two = lines > 1 && next.size() > 1;
            v.setTextViewText(R.id.w_l2, two ? withRel(next.get(1), now) : "");
            v.setViewVisibility(R.id.w_l2, two ? View.VISIBLE : View.GONE);
        }

        int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (head != null && !head.optString("k").isEmpty()) open.putExtra("push_k", head.optString("k")).putExtra("push_id", head.optString("id", ""));
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7100 + id, open, f));
        v.setOnClickPendingIntent(R.id.w_mic, PendingIntent.getActivity(c, 7200 + id, voice(c), f));
        v.setOnClickPendingIntent(R.id.w_mic_s, PendingIntent.getActivity(c, 7300 + id, voice(c), f));
        v.setOnClickPendingIntent(R.id.w_go_sch, PendingIntent.getActivity(c, 7400 + id, go(c, "sched"), f));
        v.setOnClickPendingIntent(R.id.w_go_led, PendingIntent.getActivity(c, 7500 + id, go(c, cards > 0 ? "card" : "ledger"), f));
        m.updateAppWidget(id, v);
    }

    static Intent go(Context c, String k) {
        return new Intent(c, MainActivity.class).setAction("com.seolyeon.family.GO_" + k).putExtra("push_k", k).putExtra("push_id", "")
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
    static Intent voice(Context c) {
        return new Intent(c, MainActivity.class).setAction("com.seolyeon.family.VOICE")
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
}
