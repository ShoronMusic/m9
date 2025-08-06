import { createTheme } from '@mui/material/styles';

const theme = createTheme({
	typography: {
		fontFamily: 'Arial, sans-serif',
	},
	palette: {
		primary: {
			main: '#1e3a8a', // 深い青（メインカラー）
			light: '#3b82f6', // 明るい青
			dark: '#1e40af', // 暗い青
		},
		secondary: {
			main: '#06b6d4', // シアン（アクセントカラー）
			light: '#22d3ee', // 明るいシアン
			dark: '#0891b2', // 暗いシアン
		},
		background: {
			default: '#f8fafc', // 薄いグレー
			paper: '#ffffff',
		},
		text: {
			primary: '#1e293b', // 深いグレー
			secondary: '#64748b', // 中程度のグレー
		},
		success: {
			main: '#10b981', // エメラルドグリーン
		},
		error: {
			main: '#ef4444', // 赤
		},
		warning: {
			main: '#f59e0b', // オレンジ
		},
		info: {
			main: '#3b82f6', // 青
		},
	},
	breakpoints: {
		values: {
			xs: 0,
			sm: 600,
			md: 960,
			lg: 1280,
			xl: 1920,
		},
	},
});

export default theme;
