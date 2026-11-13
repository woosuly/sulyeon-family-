package com.seolyeon.family;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.regex.Pattern;

/**
 * 카드 결제·취소 문자와 그 밖의 문자(택배·예약 등) 보관함. 인증번호 문자는 넣지 않음.
 * 알림에서 읽은 문자 원문을 폰에 잠시 모아 두었다가, 앱이 열리면 웹화면이 가져가서 가계부 확인 대기로 올림.
 * (분석·카드 지정은 웹에서 하므로 여기서는 '카드 승인/취소 문자처럼 보이는 것'만 넓게 거름)
 */
public class CardQueue {
    private static final String PREF = "card_queue", KEY = "items";
    private static final int MAX = 300;
    /** 카드 문자처럼 보이는 글: 숫자4자리+승인/취소, 그리고 금액(원) */
    static final Pattern LOOKS_CARD = Pattern.compile("\\d{4}\\s*(승인|취소)[\\s\\S]*?[\\d,]+\\s*원|(승인|취소)[\\s\\S]*?\\d{4}[\\s\\S]*?[\\d,]+\\s*원");

    /** 인증번호·비밀번호 문자는 저장하지 않음 (폰 밖으로 나가지 않게) */
    static final Pattern SECRET = Pattern.compile("인증\\s*번호|인증\\s*코드|인증요청|본인\\s*확인|OTP|otp|[Vv]erification|비밀번호|보안\\s*코드|확인\\s*코드");
    static boolean isSecret(String t) { return t == null || SECRET.matcher(t).find(); }

    static boolean looksCard(String t) {
        return t != null && t.length() < 600 && (t.contains("카드") || t.contains("삼성")) && LOOKS_CARD.matcher(t).find();
    }

    /** 새 문자면 추가하고 true (같은 원문은 한 번만) */
    static synchronized boolean add(Context c, String text, long ts) { return add(c, text, ts, "", "card"); }

    /** kind: card(카드 문자) / sms(그 밖의 문자), from: 보낸 사람(연락처 이름 또는 번호) */
    static synchronized boolean add(Context c, String text, long ts, String from, String kind) {
        try {
            SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            JSONArray a = new JSONArray(p.getString(KEY, "[]"));
            String norm = text.replaceAll("\\s+", " ").trim();
            if (isSecret(norm)) return false;
            for (int i = 0; i < a.length(); i++) if (norm.equals(a.getJSONObject(i).optString("text"))) return false;
            JSONObject o = new JSONObject();
            o.put("text", norm);
            o.put("ts", ts);
            o.put("from", from == null ? "" : from);
            o.put("kind", kind);
            a.put(o);
            while (a.length() > MAX) a.remove(0);
            p.edit().putString(KEY, a.toString()).apply();
            return true;
        } catch (Exception e) { return false; }
    }

    static synchronized int size(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KEY, "[]")).length(); }
        catch (Exception e) { return 0; }
    }

    /** 모두 꺼내고 비움 */
    static synchronized JSONArray take(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
        try {
            JSONArray a = new JSONArray(p.getString(KEY, "[]"));
            p.edit().putString(KEY, "[]").apply();
            return a;
        } catch (Exception e) { return new JSONArray(); }
    }
}
