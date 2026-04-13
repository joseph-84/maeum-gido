import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maeumgido.app',
  appName: '마음의 기도',
  webDir: 'build',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // 배포 시 false
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#2D5016',
      sound: 'default',
    },
    Preferences: {
      group: 'MaeumGidoStorage',
    },
  },
};

export default config;
