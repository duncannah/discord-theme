const fs = require("node:fs");
const path = require("node:path");
const fetchCss = require("./fetch-css");
const { checkIfStringStartsWith, forEveryColor } = require("./util");

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
		let newVal = forEveryColor(property.value, ({ hue, saturation, lightness, alpha }) => {
			if (saturation <= 10) return;

			if (
				(hue >= 190 && hue <= 250) ||
				hue === 38 || // mentionned
				hue === 139 // "positive" text
			) {
				hue = "$custom-hue";
			} else return;

			return [hue, saturation, lightness, alpha];
		});

		if (newVal !== property.value) {
			arr.push(`${property.name}: #{${newVal}}`);

			if (property.name.startsWith("--")) arr.push(`${property.name}-bg: #{${newVal}}`);
		}

		return arr;
	},
	(property) => {
		const arr = [];

		// TODO: fix container-3wLKDe which has hardcoded hex value

		let newVal = forEveryColor(property.value, ({ hue, saturation, lightness, alpha }) => {
			if (saturation >= 10) return;

			let darkening = 0.5;

			lightness = lightness * darkening;

			if (alpha !== 1) alpha = alpha * darkening;

			return [hue, saturation, lightness, alpha];
		});

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

	let variables = [];

	function parseBlock(block) {
		let selector = block[1].replace(/\n/g, " ").trim();
		let match = block[2].matchAll(/([a-z0-9-]+?):(.*?)(?:;|$)/gi);

		// TODO: handle media queries
		if (selector.startsWith("@")) return;

		// TODO: handle animations
		if (selector.startsWith(",")) return;

		if (selector.includes(".theme-light") && !selector.includes(".theme-dark")) return;

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
				for (const rule of rulz) {
					if (rule.startsWith("--")) variables.push(rule.substring(2));
				}

				rules.push([selector, rulz]);
			}
		}
	}

	for (let block of blocks) {
		parseBlock(block);
	}

	let out = "/** GENERATED FILE; DO NOT EDIT **/\n\n\n";

	for (const vars of variables) {
		out += `\$${vars};\n`;
	}

	for (const [selector, properties] of rules) {
		if (selector.startsWith("&")) {
			out += `html { ${selector} { ${properties.join("; ")} } }\n`;
		} else out += `${selector} { ${properties.join("; ")} }\n`;
	}

	fs.writeFileSync(outPath, out);
};
