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
 *  - 윗줄: 날짜 · 날씨 (앱이 마지막으로 받은 값)
 *  - 큰 줄: 지금 가장 중요한 한 가지 — 2시간 안 일정 > 답장 대기 > 오늘 챙길 것 > 다음 일정
 *  - 4×2로 늘리면 다음 일정 2개
 *  - 마이크: 바로 듣기 시작 / 나머지: 앱 열기
 *  앱(js/features/widget.js)이 SeolyeonNative.widgetSet 으로 후보 목록을 넣고, 고르기·남은 시간은 여기서 매번 계산
 *  후보: {text, at(시각 ms, 없으면 0), until(이때까지 보임), p(1 가장 급함 ~ 9), k(누르면 열 화면)}
 */
public class GlanceWidget extends AppWidgetProvider {
    static final String PREF = "widget";

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) render(c, m, id); }
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
        String wx = "", empty = "말로 하기를 눌러 무엇이든 맡겨 보세요";
        List<JSONObject> items = new ArrayList<>();
        try {
            JSONObject d = new JSONObject(raw); wx = d.optString("wx", ""); empty = d.optString("empty", empty);
            JSONArray a = d.optJSONArray("items");
            for (int i = 0; a != null && i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i); long until = o.optLong("until", 0), at = o.optLong("at", 0);
                if (until > 0 && until < now) continue;
                if (at > 0 && at - now <= 2 * 3600e3 && at > now - 30 * 60e3) o.put("p", 1);   // 2시간 안 일정이 가장 먼저
                items.add(o);
            }
        } catch (Exception ignored) { }
        items.sort((x, y) -> { int p = Integer.compare(x.optInt("p", 9), y.optInt("p", 9)); if (p != 0) return p; long ax = x.optLong("at", Long.MAX_VALUE), ay = y.optLong("at", Long.MAX_VALUE); return Long.compare(ax == 0 ? Long.MAX_VALUE : ax, ay == 0 ? Long.MAX_VALUE : ay); });

        String date = new SimpleDateFormat("M.d E", Locale.KOREAN).format(now);
        v.setTextViewText(R.id.w_top, wx.isEmpty() ? date : date + "  ·  " + wx);
        JSONObject head = items.isEmpty() ? null : items.get(0);
        v.setTextViewText(R.id.w_main, head == null ? empty : withRel(head, now));

        // 크게 놓았으면 다음 일정 2개 (시각 있는 것, 머리 줄 제외)
        Bundle op = m.getAppWidgetOptions(id); int h = op == null ? 0 : op.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        List<JSONObject> next = new ArrayList<>();
        for (JSONObject o : items) if (o != head && o.optLong("at", 0) > now - 30 * 60e3 && o.optLong("at", 0) > 0) next.add(o);
        next.sort((x, y) -> Long.compare(x.optLong("at"), y.optLong("at")));
        boolean big = h >= 110 && !next.isEmpty();
        v.setViewVisibility(R.id.w_more, big ? View.VISIBLE : View.GONE);
        if (big) {
            v.setTextViewText(R.id.w_l1, withRel(next.get(0), now));
            v.setTextViewText(R.id.w_l2, next.size() > 1 ? withRel(next.get(1), now) : "");
            v.setViewVisibility(R.id.w_l2, next.size() > 1 ? View.VISIBLE : View.GONE);
        }

        int f = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (head != null && !head.optString("k").isEmpty()) open.putExtra("push_k", head.optString("k")).putExtra("push_id", head.optString("id", ""));
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 7100 + id, open, f));
        v.setOnClickPendingIntent(R.id.w_mic, PendingIntent.getActivity(c, 7200 + id, voice(c), f));
        m.updateAppWidget(id, v);
    }

    static Intent voice(Context c) {
        return new Intent(c, MainActivity.class).setAction("com.seolyeon.family.VOICE")
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    }
}
