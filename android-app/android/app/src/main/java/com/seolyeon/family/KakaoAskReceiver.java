package com.seolyeon.family;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** "읽어드릴까요?" 팝업 알림의 [읽어주기] · [괜찮아요] 버튼 */
public class KakaoAskReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String room = i.getStringExtra("room");
        if (room == null) return;
        if (KakaoAsk.ACT_READ.equals(i.getAction())) KakaoAsk.read(c, room);
        else { KakaoAsk.clear(room); KakaoAsk.cancel(c, room); }
    }
}
