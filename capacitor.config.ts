import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'AgroSenseV2',
  webDir: 'www',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com']
    }
  }
};

export default config;