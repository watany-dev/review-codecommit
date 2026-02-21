const stubDevtools = {
	name: "stub-devtools",
	setup(build: { onResolve: Function; onLoad: Function }) {
		build.onResolve(
			{ filter: /^react-devtools-core$/ },
			() => ({ path: "react-devtools-core", namespace: "stub" }),
		);
		build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
			contents: "export default {};",
			loader: "js",
		}));
	},
};

const [cliResult, libResult] = await Promise.all([
	Bun.build({
		entrypoints: ["./src/cli.tsx"],
		outdir: "./dist",
		format: "esm",
		target: "node",
		minify: true,
		naming: "cli.mjs",
		plugins: [stubDevtools],
	}),
	Bun.build({
		entrypoints: ["./src/index.ts"],
		outdir: "./dist",
		format: "esm",
		target: "node",
		minify: true,
		plugins: [stubDevtools],
	}),
]);

let failed = false;
for (const result of [cliResult, libResult]) {
	if (!result.success) {
		failed = true;
		console.error("Build failed:");
		for (const log of result.logs) {
			console.error(log);
		}
	}
}

if (failed) {
	process.exit(1);
}

for (const result of [cliResult, libResult]) {
	for (const output of result.outputs) {
		const name = output.path.split("/").pop();
		const sizeKB = (output.size / 1024).toFixed(1);
		console.log(`  ${name}  ${sizeKB} KB`);
	}
}
