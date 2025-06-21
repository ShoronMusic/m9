import { createTheme } from '@mui/material/styles';

const theme = createTheme({
	typography: {
		fontFamily: 'Arial, sans-serif',
	},
	palette: {
		primary: {
			main: '#2196F3',
		},
		secondary: {
			main: '#FF5722',
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
