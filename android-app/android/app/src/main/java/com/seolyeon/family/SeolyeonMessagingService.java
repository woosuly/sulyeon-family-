package com.seolyeon.family;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** 서버가 보낸 알림(데이터 메시지)을 받아 직접 표시. 앱이 꺼져 있어도 동작 */
public class SeolyeonMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        super.onMessageReceived(msg);
        Map<String, String> d = msg.getData();
        if (d == null || d.isEmpty()) return;
        // 앱을 보고 있으면 앱 화면이 직접 알려 줌 (긴급은 항상 표시)
        if (MainActivity.foreground && !"sos".equals(d.get("k"))) return;
        Notify.show(getApplicationContext(), d);
    }
}
