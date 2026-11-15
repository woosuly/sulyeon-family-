package com.seolyeon.family;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 위챗·회사 메신저 등 '알림 받을 앱'과 알림 답장 칸으로 바로 보내기.
 *  - 받을 앱: 사용자가 설정에서 고름 (위챗은 처음부터 켜 둠). 최근 알림을 보낸 앱 이름만 기록(내용은 기록 안 함)
 *  - 바로 보내기: 알림에 '답장' 입력칸이 있는 앱(카톡·문자 등)은 최근 알림의 답장 칸을 기억했다가 그 칸으로 보냄
 *    (기억은 폰 메모리에만, 24시간. 알림을 지웠거나 폰을 껐다 켜면 그 방에서 새 메시지가 와야 다시 보낼 수 있음)
 */
public class MsgHub {
    static final String PREF = "msg_apps", WECHAT = "com.tencent.mm";

    // ── 받을 앱 ──
    static synchronized JSONArray allow(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        try { return new JSONArray(p.getString("allow", "[\"" + WECHAT + "\"]")); } catch (Exception e) { return new JSONArray(); }
    }
    static synchronized boolean allowed(Context c, String pkg) {
        JSONArray a = allow(c);
        for (int i = 0; i < a.length(); i++) if (pkg.equals(a.optString(i))) return true;
        return false;
    }
    static synchronized void setAllowed(Context c, String pkg, boolean on) {
        try {
            JSONArray a = allow(c), b = new JSONArray();
            for (int i = 0; i < a.length(); i++) if (!pkg.equals(a.optString(i))) b.put(a.optString(i));
            if (on) b.put(pkg);
            c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putString("allow", b.toString()).apply();
        } catch (Exception ignored) { }
    }
    static String label(Context c, String pkg) {
        try { PackageManager pm = c.getPackageManager(); return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); }
        catch (Exception e) { return WECHAT.equals(pkg) ? "위챗" : pkg; }
    }
    /** 최근 알림을 보낸 앱 (앱 이름만, 최대 40개) */
    static synchronized void seen(Context c, String pkg) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            JSONArray a = new JSONArray(p.getString("seen", "[]")), b = new JSONArray();
            long now = System.currentTimeMillis();
            if (a.length() > 0 && pkg.equals(a.getJSONObject(0).optString("pkg")) && now - a.getJSONObject(0).optLong("ts") < 60000) return;
            JSONObject me = new JSONObject(); me.put("pkg", pkg); me.put("label", label(c, pkg)); me.put("ts", now);
            b.put(me);
            for (int i = 0; i < a.length() && b.length() < 40; i++) if (!pkg.equals(a.getJSONObject(i).optString("pkg"))) b.put(a.getJSONObject(i));
            p.edit().putString("seen", b.toString()).apply();
        } catch (Exception ignored) { }
    }
    static synchronized JSONArray seenList(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString("seen", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    // ── 바로 보내기 (알림 답장 칸) ──
    static class Target { String pkg, app, room; Notification.Action action; long ts; }
    private static final Map<String, Target> targets = new LinkedHashMap<>();

    static Notification.Action findReply(Notification n) {
        List<Notification.Action> all = new ArrayList<>();
        if (n.actions != null) all.addAll(Arrays.asList(n.actions));
        try { all.addAll(new Notification.WearableExtender(n).getActions()); } catch (Exception ignored) { }
        for (Notification.Action a : all) {
            RemoteInput[] ri = a.getRemoteInputs();
            if (ri != null && a.actionIntent != null) for (RemoteInput r : ri) if (r.getAllowFreeFormInput()) return a;
        }
        return null;
    }
    static synchronized void remember(Context c, String pkg, String room, Notification n) {
        if (room == null || room.isEmpty() || n == null) return;
        Notification.Action a = findReply(n); if (a == null) return;
        Target t = new Target(); t.pkg = pkg; t.app = label(c, pkg); t.room = room; t.action = a; t.ts = System.currentTimeMillis();
        targets.remove(pkg + "|" + room); targets.put(pkg + "|" + room, t);
        while (targets.size() > 60) { Iterator<String> it = targets.keySet().iterator(); it.next(); it.remove(); }
    }
    static synchronized JSONArray targetList() {
        JSONArray a = new JSONArray(); long now = System.currentTimeMillis();
        List<Target> l = new ArrayList<>(targets.values());
        for (int i = l.size() - 1; i >= 0; i--) {
            Target t = l.get(i); if (now - t.ts > 24 * 3600000L) continue;
            try { JSONObject o = new JSONObject(); o.put("pkg", t.pkg); o.put("app", t.app); o.put("room", t.room); o.put("ts", t.ts); a.put(o); } catch (Exception ignored) { }
        }
        return a;
    }
    /** 보냄 성공 true. 실패 이유는 err[0] */
    static synchronized boolean send(Context c, String pkg, String room, String text, String[] err) {
        Target t = targets.get(pkg + "|" + room);
        if (t == null || System.currentTimeMillis() - t.ts > 24 * 3600000L) { err[0] = "이 방의 답장 칸이 없습니다 (그 방에서 새 메시지가 와야 보낼 수 있음)"; return false; }
        try {
            RemoteInput[] ri = t.action.getRemoteInputs();
            Intent in = new Intent(); Bundle b = new Bundle();
            for (RemoteInput r : ri) b.putCharSequence(r.getResultKey(), text);
            RemoteInput.addResultsToIntent(ri, in, b);
            t.action.actionIntent.send(c, 0, in);
            return true;
        } catch (PendingIntent.CanceledException e) {
            targets.remove(pkg + "|" + room); err[0] = "답장 칸이 만료됐습니다 (그 방에서 새 메시지가 와야 보낼 수 있음)"; return false;
        } catch (Exception e) { err[0] = String.valueOf(e.getMessage()); return false; }
    }
}
