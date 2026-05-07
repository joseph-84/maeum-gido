package com.maeumgido.app;

import android.os.Bundle;
import android.util.Log;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MaeumGido";
    private long backPressedTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 로컬 플러그인 명시적 등록 (Capacitor 자동감지 미적용 대비)
        registerPlugin(NativeAlarmPlugin.class);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() ->
                        getBridge().getWebView().evaluateJavascript(
                            // hasOpenModal() 결과를 반환받아 분기
                            "(function(){ window.dispatchEvent(new CustomEvent('app-back-press')); return window.__hasOpenModal ? window.__hasOpenModal() : false; })()",
                            result -> {
                                if (!"true".equals(result)) {
                                    runOnUiThread(() -> {
                                        long now = System.currentTimeMillis();
                                        if (now - backPressedTime < 2000) {
                                            finishAffinity();
                                        } else {
                                            backPressedTime = now;
                                            android.widget.Toast.makeText(
                                                MainActivity.this,
                                                "뒤로 버튼을 한 번 더 누르면 종료됩니다",
                                                android.widget.Toast.LENGTH_SHORT
                                            ).show();
                                        }
                                    });
                                }
                            }
                        )
                    );
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().getDecorView().post(() -> {
            ViewCompat.setOnApplyWindowInsetsListener(
                getWindow().getDecorView(),
                (view, windowInsets) -> {
                    int navBarPx = windowInsets
                        .getInsets(WindowInsetsCompat.Type.navigationBars())
                        .bottom;
                    float density = getResources().getDisplayMetrics().density;
                    int navBarDp = Math.round(navBarPx / density);
                    Log.d(TAG, "navBarHeight px=" + navBarPx + " dp=" + navBarDp);
                    // CSS px ≈ dp; env(safe-area-inset-bottom)이 우선이지만 백업으로도 설정
                    String js = String.format(
                        "document.documentElement.style.setProperty('--nav-bar-height', '%dpx');" +
                        "document.documentElement.style.setProperty('--ion-safe-area-bottom', '%dpx');",
                        navBarDp, navBarDp
                    );
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().post(() ->
                            getBridge().getWebView().evaluateJavascript(js, null)
                        );
                    }
                    return WindowInsetsCompat.CONSUMED;
                }
            );
            ViewCompat.requestApplyInsets(getWindow().getDecorView());
        });
    }
}