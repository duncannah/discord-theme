const parseCSSColor = require("parse-css-color");

function rgbToHsl(r, g, b, a = 1) {
	(r /= 255), (g /= 255), (b /= 255);
	let max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h,
		s,
		l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		let d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return [h, s, l, a];
}

function checkIfStringStartsWith(str, substrs) {
	return substrs.some((substr) => str.startsWith(substr));
}

/**
 * @param {string} str
 * @param {({hue: number, saturation: number, lightness: number, alpha: number}) => [number, number, number, number?]} callback
 */
function forEveryColor(str, callback) {
	return (
		str &&
		str.replace(
			/(?:rgba?\(.*?\)|hsla?\(.*?\)|#[0-9a-f]{8}|#[0-9a-f]{6}|#[0-9a-f]{4}|#[0-9a-f]{3})(?= |,|$)/gi,
			(match) => {
				let vals = parseCSSColor(match);
				if (vals === null) return match;

				if (vals.type === "rgb") {
					let hsl = rgbToHsl(vals.values[0], vals.values[1], vals.values[2]).map((v) =>
						Math.round(v * 100)
					);
					vals = parseCSSColor(`hsla(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%, ${vals.alpha})`);
				}

				if (vals === null) {
					console.error(`Could not parse color: ${match}`);
					return match;
				}

				const retVal = callback({
					hue: vals.values[0],
					saturation: vals.values[1],
					lightness: vals.values[2],
					alpha: vals.alpha,
				});

				if (!retVal) return match;

				return `hsla(${retVal[0]}, ${retVal[1]}%, ${retVal[2]}%, ${
					retVal[3] || vals.alpha
				})`;
			}
		)
	);
}

module.exports = {
	checkIfStringStartsWith,
	forEveryColor,
};
