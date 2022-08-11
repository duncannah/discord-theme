const fs = require("node:fs");
const path = require("node:path");
const prettier = require("prettier");

module.exports = async function () {
	if (!fs.existsSync(path.join("discord.css"))) {
		console.log("Downloading discord.css...");
		await fetch("https://discord.com/app")
			.then((res) => res.text())
			.then(async (body) => {
				let match = body.match(/<link rel="stylesheet" href="(.*?)"/i);

				if (match) {
					fs.writeFileSync(
						path.join("discord.css"),
						await fetch("https://discord.com/" + match[1]).then((res) => res.text())
					);
				} else throw new Error("Could not find discord.css");
			});

		console.log("Formatting discord.css...");
		fs.writeFileSync(
			path.join("discord.legible.css"),
			await prettier.format(fs.readFileSync(path.join("discord.css"), "utf8"), {
				parser: "css",
			})
		);
	}
};
