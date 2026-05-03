package club.elitetok.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Receives FCM "data" messages from the Elite Tok Club server and posts
 * styled native notifications, even when the WebView is killed. Tapping a
 * notification opens MainActivity with the deep-link URL in the intent
 * data — the JS layer's pushNotificationActionPerformed listener picks it
 * up and routes via React Router.
 */
public class EliteTokFcmService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "elite_tok_admin_alerts";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String title = data.getOrDefault("title", "Elite Tok Admin");
        String body  = data.getOrDefault("body", "");
        String url   = data.getOrDefault("url", "/admin");
        String tag   = data.getOrDefault("tag", "elite-tok");

        ensureChannel();

        Intent open = new Intent(this, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("club.elitetok.admin://" + url.replaceFirst("^/", "")));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("etc_url", url);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, tag.hashCode(), open, piFlags);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(tag.hashCode(), b.build());
    }

    @Override
    public void onNewToken(String token) {
        // The Capacitor push-notifications plugin's `registration` listener
        // re-fires on app open, so we don't need to forward here. If you
        // want immediate refresh-on-rotate behavior, ping a small endpoint
        // with the new token here.
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel c = new NotificationChannel(
                CHANNEL_ID,
                "Case alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        c.setDescription("New client messages, deadlines, escalations and assignments.");
        nm.createNotificationChannel(c);
    }
}
