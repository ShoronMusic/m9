import { createTheme } from '@mui/material/styles';

const theme = createTheme({
	typography: {
		fontFamily: 'Arial, sans-serif',
	},
	palette: {
		primary: {
			main: '#00BFFF',
		},
		secondary: {
			main: '#FF4081',
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
