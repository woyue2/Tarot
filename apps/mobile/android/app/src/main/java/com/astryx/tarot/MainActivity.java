package com.astryx.tarot;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.plugin.CapacitorHttp;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 CapacitorHttp 插件：让 fetch 走原生 HTTP 层，绕过 WebView 限制
        registerPlugin(CapacitorHttp.class);
        super.onCreate(savedInstanceState);
    }
}
