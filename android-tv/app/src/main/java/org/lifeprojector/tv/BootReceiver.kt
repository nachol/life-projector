package org.lifeprojector.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts the projection automatically when the TV / box powers on (installations, shops, events). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = Prefs(ctx)
        if (!prefs.autostart || prefs.serverUrl.isEmpty()) return
        ctx.startActivity(Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
