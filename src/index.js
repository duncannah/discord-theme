require("dotenv").config();
const sass = require("sass");
const fs = require("node:fs/promises");
const { default: postcss } = require("postcss");
const overwrite = require("./overwrite");
const path = require("node:path");

if (typeof process.env.DEPLOY_PATH !== "string") throw new Error("DEPLOY_PATH is not defined");

(async () => {
	await fs.mkdir(path.join(__dirname, "style/__gen"));

	await overwrite(path.join(__dirname, "style/__gen", "overwrite.scss"));

	const scss = await fs.readFile("./src/style/main.scss", "utf8");

	const sassOut = sass.compileString(scss, { loadPaths: ["./src/style"], charset: false });

	const postOut = await postcss([
		require("postcss-inline-base64")({ baseDir: "./src/style" }),
	]).process(sassOut.css, {
		from: undefined,
		to: `${process.env.DEPLOY_PATH}/duncan.theme.css`,
	});

	await fs.writeFile(`${process.env.DEPLOY_PATH}/duncan.theme.css`, postOut.css);

	console.log(`- Successfully transpiled at ${new Date().toISOString()}`);
})();
