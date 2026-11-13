package com.seolyeon.family;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import java.util.List;

/**
 * 폰에 뜨는 알림 중 문자 앱의 문자와 카드 결제·취소 문자만 골라 보관함(CardQueue)에 넣음.
 * 다른 앱 알림과 인증번호 문자는 저장하지 않음. 카드 문자가 새로 들어오면 '가계부 확인 대기' 알림을 띄움.
 */
public class CardNotifListener extends NotificationListenerService {
    /** 문자 앱 (삼성 메시지, 구글 메시지, 기본 문자) */
    private static final List<String> SMS_APPS = Arrays.asList(
            "com.samsung.android.messaging", "com.google.android.apps.messaging",
            "com.android.mms", "com.android.messaging");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;
            Bundle x = n.extras;
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;   // '새 메시지 3개' 같은 묶음 요약은 건너뜀
            boolean smsApp = SMS_APPS.contains(sbn.getPackageName());
            CharSequence title = x.getCharSequence(Notification.EXTRA_TITLE);
            String from = title == null ? "" : title.toString();

            // 알림 하나에 문자 여러 개가 묶여 올 수 있어 모두 확인
            Set<String> texts = new LinkedHashSet<>();
            addCs(texts, x.getCharSequence(Notification.EXTRA_BIG_TEXT));
            addCs(texts, x.getCharSequence(Notification.EXTRA_TEXT));
            CharSequence[] lines = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) for (CharSequence l : lines) addCs(texts, l);
            Parcelable[] msgs = android.os.Build.VERSION.SDK_INT >= 24 ? x.getParcelableArray(Notification.EXTRA_MESSAGES) : null;
            if (msgs != null) for (Parcelable m : msgs) {
                if (m instanceof Bundle) addCs(texts, ((Bundle) m).getCharSequence("text"));
            }

            int added = 0;
            for (String t : texts) {
                if (CardQueue.looksCard(t)) {
                    if (CardQueue.add(this, t, sbn.getPostTime(), from, "card")) added++;
                } else if (smsApp) {
                    CardQueue.add(this, t, sbn.getPostTime(), from, "sms");   // 택배·예약 등: 앱을 열 때 비서가 정리
                }
            }
            if (added > 0) {
                int total = CardQueue.size(this);
                Map<String, String> d = new HashMap<>();
                d.put("k", "card");
                d.put("id", "");
                d.put("tag", "card-pending");
                d.put("title", "가계부 확인 대기 " + total + "건");
                d.put("body", "카드 결제 문자를 받았습니다. 눌러서 가계부 반영을 확인하세요.");
                Notify.show(this, d);
                SeolyeonNativePlugin.fireCardQueued(total);
            }
        } catch (Exception ignored) { }
    }

    private static void addCs(Set<String> s, CharSequence cs) {
        if (cs != null && cs.length() > 0) s.add(cs.toString());
    }
}
