package org.lifeprojector.tv

import android.content.Context
import android.os.Build
import android.provider.Settings

class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("lifeprojector", Context.MODE_PRIVATE)
    private val androidId: String =
        Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID) ?: "tv"

    var serverUrl: String
        get() = sp.getString("serverUrl", "") ?: ""
        set(v) = sp.edit().putString("serverUrl", v.trim().trimEnd('/')).apply()

    var displayName: String
        get() = sp.getString("displayName", null) ?: "${Build.MODEL} (${androidId.takeLast(4).uppercase()})"
        set(v) = sp.edit().putString("displayName", v.trim()).apply()

    var autostart: Boolean
        get() = sp.getBoolean("autostart", true)
        set(v) = sp.edit().putBoolean("autostart", v).apply()

    /** Stable id so the server remembers this screen's calibration. */
    val displayId: String get() = "atv-" + androidId.filter { it.isLetterOrDigit() }.take(16)
}
