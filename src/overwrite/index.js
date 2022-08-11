const fs = require("node:fs");
const path = require("node:path");
const fetchCss = require("./fetch-css");

// utils
function checkIfStringStartsWith(str, substrs) {
	return substrs.some((substr) => str.startsWith(substr));
}

const specialCases = [
	(property) => {
		// make font-size relative to modifier
		if (property.name === "font-size") {
			let size = property.value
				.replace(" !important", "")
				.replace(/\n|{|}/g, " ")
				.trim();
			if (size.endsWith("px") || size.endsWith("rem"))
				return [`font-size: ${size} * $font-size-modifier`];
		}
	},
	(property) => {
		// display text
		// this was a bit too much so I disabled it
		// if (property.name === "font-family" && property.value.includes("--font-display"))
		// 	return [`&, * { font-weight: bold; text-transform: uppercase; }`];

		if (property.name === "text-transform" && property.value === "uppercase")
			return [`&, * { font-family: var(--font-display) }`];
	},
	(property) => {
		// border-radius
		if (property.name === "border-radius") {
			return [`border-radius:${property.value.replace(/(\d+)px/g, "($1px * 2)")}`];
		}
	},
	(property) => {
		const arr = [];
		// replace discord colors with our own
		let newVal = property.value.replace(
			/(hsla?)\((?:([\d\.%]+)[, ]+)(?:([\d\.%]+)[, ]+)(?:([\d\.%]+)[,\)])(?:([\d\.%]+) *\))?/gi,
			(match, type, hue, saturation, lightness, alpha) => {
				if (parseFloat(saturation) <= 10) return match;

				if (hue >= 190 && hue <= 250) {
					// hue = parseInt(hue) + 40;
					hue = 270;
				} else return match;

				// no % next to lightness bc we haven't touched it

				return `${type}(${hue}, ${saturation}, ${lightness} ${
					typeof alpha !== "undefined" ? `, ${alpha}` : ""
				})`;
			}
		);

		if (newVal !== property.value) {
			arr.push(`${property.name}: ${newVal}`);

			if (property.name.startsWith("--")) arr.push(`${property.name}-bg: ${newVal}`);
		}

		return arr;
	},
	(property) => {
		const arr = [];

		let newVal = property.value.replace(
			/(hsla?)\((?:([\d\.%]+)[, ]+)(?:([\d\.%]+)[, ]+)(?:([\d\.%]+)[,\)])(?:([\d\.%]+) *\))?/gi,
			(match, type, hue, saturation, lightness, alpha) => {
				if (parseFloat(saturation) >= 10) return match;

				let darkening = 0.5;

				lightness = parseFloat(lightness) * darkening;

				if (type === "hsla") alpha = parseFloat(alpha) * darkening;

				return `${type}(${hue}, ${saturation}, ${lightness}% ${
					typeof alpha !== "undefined" ? `, ${alpha}` : ""
				})`;
			}
		);

		if (newVal !== property.value) {
			if (property.name.startsWith("--")) arr.push(`${property.name}-bg: ${newVal}`);
			else if (checkIfStringStartsWith(property.name, ["background", "border"]))
				arr.push(`${property.name}: ${newVal}`);
		}

		if (
			checkIfStringStartsWith(property.name, ["background", "border"]) &&
			property.value.includes("var(--")
		) {
			arr.push(`${property.name}: ${property.value.replace(/var\(--[\w-]+/, "$&-bg, $&)")}`);
		}

		return arr;
	},
];

const rules = [];

module.exports = async function (outPath) {
	await fetchCss();

	const file = fs.readFileSync(path.join("discord.css"), "utf8");

	let blocks = file.matchAll(/([^{}%]+) *{(.*?)}/g);

	function parseBlock(block) {
		let selector = block[1].replace(/\n/g, " ").trim();
		let match = block[2].matchAll(/([a-z0-9-]+?):(.*?)(?:;|$)/gi);

		// TODO: handle media queries
		if (selector.startsWith("@")) return;

		// TODO: handle animations
		if (selector.startsWith(",")) return;

		if (match) {
			let rulz = [];
			for (let property of match) {
				let name = property[1].trim();
				let value = property[2].trim();

				// simplify
				value = value.replace(
					/calc\(var\(--saturation-factor, 1\) ?\* ?([\d\.]+%)\)/gi,
					`$1`
				);

				rulz.push(...specialCases.map((fn) => fn({ name, value, selector }) || []).flat());
			}

			if (rulz && rulz.length) {
				rules.push([selector, rulz]);
			}
		}
	}

	for (let block of blocks) {
		parseBlock(block);
	}

	let out = "";

	for (const [selector, properties] of rules) {
		if (selector.startsWith("&")) {
			out += `html { ${selector} { ${properties.join("; ")} } }\n`;
		} else out += `${selector} { ${properties.join("; ")} }\n`;
	}

	fs.writeFileSync(outPath, out);
};
