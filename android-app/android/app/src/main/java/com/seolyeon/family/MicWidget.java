package com.seolyeon.family;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** 말로 하기 1×1: 누르면 설연이 열리며 바로 듣기 시작 (빅스비를 거치지 않아 음악 재생 중에도 됨) */
public class MicWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_mic);
            PendingIntent pi = PendingIntent.getActivity(c, 7300 + id, GlanceWidget.voice(c), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.wm_root, pi);
            v.setOnClickPendingIntent(R.id.wm_btn, pi);
            m.updateAppWidget(id, v);
        }
    }
}
