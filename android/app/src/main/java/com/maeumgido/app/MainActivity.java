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
        super.onCreate(savedInstanceState);

        // 뒤로 버튼 처리
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                long currentTime = System.currentTimeMillis();
                // 2초 안에 두 번 누르면 종료
                if (currentTime - backPressedTime < 2000) {
                    finishAffinity(); // 앱 완전 종료
                } else {
                    backPressedTime = currentTime;
                    // 토스트 메시지로 안내
                    android.widget.Toast.makeText(
                        MainActivity.this,
                        "뒤로 버튼을 한 번 더 누르면 종료됩니다",
                        android.widget.Toast.LENGTH_SHORT
                    ).show();
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
                    int navBarHeight = windowInsets
                        .getInsets(WindowInsetsCompat.Type.navigationBars())
                        .bottom;

                    Log.d(TAG, "navBarHeight: " + navBarHeight);

                    String js = String.format(
                        "document.documentElement.style.setProperty('--nav-bar-height', '%dpx');",
                        navBarHeight
                    );

                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().post(() -> {
                            getBridge().getWebView().evaluateJavascript(js, result -> {
                                Log.d(TAG, "CSS 변수 주입 완료: --nav-bar-height=" + navBarHeight + "px");
                            });
                        });
                    } else {
                        Log.w(TAG, "WebView가 아직 준비되지 않음");
                    }

                    return WindowInsetsCompat.CONSUMED;
                }
            );
            ViewCompat.requestApplyInsets(getWindow().getDecorView());
        });
    }
}