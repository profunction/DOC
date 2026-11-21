package my.anxincare.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 长者模式：
 *  - setHomeApp：把安心照顾设为手机桌面（开机、按主页键都回到 App），通过一个默认关闭的 activity-alias 实现，
 *    只有在长者手机上主动开启才会生效，不影响子女和协调员的手机。
 *  - setKeepAwake：屏幕常亮。
 */
@CapacitorPlugin(name = "ElderMode")
public class ElderModePlugin extends Plugin {
    private static final String PREFS = "anxin_elder_mode";

    private ComponentName homeAlias() {
        return new ComponentName(getContext(), "my.anxincare.app.HomeAlias");
    }

    private boolean isDefaultHome() {
        Intent i = new Intent(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_HOME);
        ResolveInfo ri = getContext().getPackageManager().resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
        return ri != null && ri.activityInfo != null && getContext().getPackageName().equals(ri.activityInfo.packageName);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("isHome", isDefaultHome());
        r.put("keepAwake", getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("keepAwake", false));
        call.resolve(r);
    }

    @PluginMethod
    public void setHomeApp(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getContext().getPackageManager().setComponentEnabledSetting(
            homeAlias(),
            on ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
        // 打开系统「默认桌面」设置，让家人选安心照顾（或改回原来的桌面）
        try {
            Intent i = new Intent(Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP ? Settings.ACTION_HOME_SETTINGS : Settings.ACTION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("keepAwake", on).apply();
        getActivity().runOnUiThread(() -> applyKeepAwake(on));
        call.resolve();
    }

    void applyKeepAwake(boolean on) {
        if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void load() {
        boolean on = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("keepAwake", false);
        if (on) getActivity().runOnUiThread(() -> applyKeepAwake(true));
    }
}
