import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.brewguide.app",
	appName: "Brew Guide",
	webDir: "out",
	server: {
		androidScheme: "https",
		iosScheme: "https",
		hostname: "app",
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 2000,
			launchAutoHide: true,
			backgroundColor: "#FFFFFF",
			androidSplashResourceName: "splash",
			androidScaleType: "CENTER_CROP",
			showSpinner: false,
			splashFullScreen: true,
			splashImmersive: true,
		},
		Haptics: {
			// Haptics 插件配置
			// 默认配置即可，无需特殊设置
		},
	},
};

export default config;
