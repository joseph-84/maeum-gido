import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maeumgido.app',
  appName: '마음의 기도',
  webDir: 'build',
  android: {
    // WebView가 시스템 바 뒤까지 확장되도록 설정
    // 이후 safe-area-inset-* CSS 변수로 여백 조정
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#2D5016',
      sound: 'default',
    },
    // safe area 활성화
    EdgeToEdge: {
      backgroundColor: '#2D5016',
    },
  },
};

export default config;