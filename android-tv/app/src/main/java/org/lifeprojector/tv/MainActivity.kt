package org.lifeprojector.tv

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Setup screen: discovers Life Projector servers on the LAN (mDNS "_lifeprojector._tcp"),
 * lets the user type a URL manually, then opens the fullscreen display.
 * Built in code (no XML layouts) so it's easy to read and D-pad friendly.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var prefs: Prefs
    private lateinit var urlInput: EditText
    private lateinit var found: LinearLayout
    private lateinit var status: TextView
    private var nsd: NsdManager? = null
    private var discovery: NsdManager.DiscoveryListener? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val seen = mutableSetOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val fromDisplay = intent.getBooleanExtra(EXTRA_SETUP, false)
        if (!fromDisplay && prefs.serverUrl.isNotEmpty() && savedInstanceState == null) {
            openDisplay()
            return
        }
        setContentView(buildUi())
    }

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun focusBg(): GradientDrawable = GradientDrawable().apply {
        cornerRadius = dp(10).toFloat()
        setColor(Color.parseColor("#1D1430"))
        setStroke(dp(2), Color.parseColor("#33FFFFFF"))
    }

    private fun styledButton(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        background = focusBg()
        setPadding(dp(20), dp(12), dp(20), dp(12))
        setOnFocusChangeListener { v, has ->
            (v.background as GradientDrawable).setStroke(dp(2), Color.parseColor(if (has) "#00E5FF" else "#33FFFFFF"))
        }
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }
    }

    private fun buildUi(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(48), dp(32), dp(48), dp(32))
        }
        col.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 34f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#00E5FF"))
        })
        col.addView(TextView(this).apply { text = getString(R.string.tagline); setTextColor(Color.parseColor("#A49CB8")) })

        status = TextView(this).apply { text = getString(R.string.searching); setPadding(0, dp(20), 0, dp(4)); setTextColor(Color.parseColor("#A49CB8")) }
        col.addView(status)
        found = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(found)

        col.addView(TextView(this).apply { text = getString(R.string.server_url); setPadding(0, dp(20), 0, 0) })
        urlInput = EditText(this).apply {
            setText(prefs.serverUrl.ifEmpty { "http://192.168.1.100:8080" })
            setSingleLine()
            setTextColor(Color.WHITE)
            background = focusBg()
            setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        col.addView(urlInput)

        col.addView(TextView(this).apply { text = getString(R.string.display_name); setPadding(0, dp(14), 0, 0) })
        val nameInput = EditText(this).apply {
            setText(prefs.displayName)
            setSingleLine()
            setTextColor(Color.WHITE)
            background = focusBg()
            setPadding(dp(14), dp(10), dp(14), dp(10))
        }
        col.addView(nameInput)

        val autostart = CheckBox(this).apply {
            text = getString(R.string.autostart)
            isChecked = prefs.autostart
            setTextColor(Color.WHITE)
        }
        col.addView(autostart)

        val connect = styledButton(getString(R.string.connect)) {
            prefs.serverUrl = normalize(urlInput.text.toString())
            prefs.displayName = nameInput.text.toString().ifBlank { prefs.displayName }
            prefs.autostart = autostart.isChecked
            openDisplay()
        }
        col.addView(connect)
        col.addView(TextView(this).apply { text = getString(R.string.hint); setPadding(0, dp(16), 0, 0); setTextColor(Color.parseColor("#A49CB8")) })
        connect.requestFocus()
        return ScrollView(this).apply { addView(col); setBackgroundColor(Color.parseColor("#0B0714")) }
    }

    private fun normalize(raw: String): String {
        var u = raw.trim().trimEnd('/')
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "http://$u"
        if (Regex("^https?://[^/:]+$").matches(u)) u += ":8080"
        return u
    }

    private fun openDisplay() {
        startActivity(Intent(this, DisplayActivity::class.java))
        finish()
    }

    // ---------------- mDNS discovery ----------------
    override fun onStart() {
        super.onStart()
        if (!::found.isInitialized) return
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("lifeprojector").apply { setReferenceCounted(false); acquire() }
        val mgr = getSystemService(Context.NSD_SERVICE) as NsdManager
        nsd = mgr
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(type: String) {}
            override fun onDiscoveryStopped(type: String) {}
            override fun onStartDiscoveryFailed(type: String, code: Int) { runOnUiThread { status.text = "mDNS error $code" } }
            override fun onStopDiscoveryFailed(type: String, code: Int) {}
            override fun onServiceLost(info: NsdServiceInfo) {}
            override fun onServiceFound(info: NsdServiceInfo) { resolve(mgr, info) }
        }
        discovery = listener
        try { mgr.discoverServices("_lifeprojector._tcp", NsdManager.PROTOCOL_DNS_SD, listener) } catch (_: Exception) {}
    }

    @Suppress("DEPRECATION")
    private fun resolve(mgr: NsdManager, info: NsdServiceInfo) {
        mgr.resolveService(info, object : NsdManager.ResolveListener {
            override fun onResolveFailed(si: NsdServiceInfo, code: Int) {}
            override fun onServiceResolved(si: NsdServiceInfo) {
                val host = (if (Build.VERSION.SDK_INT >= 34) si.hostAddresses.firstOrNull() else si.host)?.hostAddress ?: return
                if (host.contains(':')) return // skip IPv6 for simplicity
                val url = "http://$host:${si.port}"
                runOnUiThread {
                    if (seen.add(url)) {
                        status.text = getString(R.string.found)
                        found.addView(styledButton("▶  ${si.serviceName}  —  $url") {
                            urlInput.setText(url)
                            prefs.serverUrl = url
                            openDisplay()
                        })
                        if (seen.size == 1) found.getChildAt(0).requestFocus()
                    }
                }
            }
        })
    }

    override fun onStop() {
        super.onStop()
        try { discovery?.let { nsd?.stopServiceDiscovery(it) } } catch (_: Exception) {}
        discovery = null
        multicastLock?.release()
    }

    companion object {
        const val EXTRA_SETUP = "setup"
    }
}
