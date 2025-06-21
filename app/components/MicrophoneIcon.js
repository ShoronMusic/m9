// src/components/MicrophoneIcon.js

function MicrophoneIcon({ color, style }) {
	const iconStyle = {
		width: '15px',
		height: '15px',
		verticalAlign: 'middle'
	};

	return (
		<svg viewBox="0 0 24 24" fill={color} style={iconStyle} xmlns="http://www.w3.org/2000/svg">
			<path d="M12 14C13.6569 14 15 12.6569 15 11V5C15 3.34315 13.6569 2 12 2C10.3431 2 9 3.34315 9 5V11C9 12.6569 10.3431 14 12 14Z" />
			<path d="M17 11C17 13.7614 14.7614 16 12 16C9.23858 16 7 13.7614 7 11H5C5 14.3137 7.68629 17 11 17V21H13V17C16.3137 17 19 14.3137 19 11H17Z" />
		</svg>
	);
}

export default MicrophoneIcon;

