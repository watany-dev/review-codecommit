/**
 * Parallel CI runner — runs independent static checks concurrently,
 * then test:coverage, then build.
 *
 * Usage: bun run scripts/ci-parallel.ts
 */

interface TaskResult {
  name: string;
  ok: boolean;
  duration: number;
}

async function run(name: string, cmd: string[]): Promise<TaskResult> {
  const start = performance.now();
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const duration = performance.now() - start;

  if (exitCode !== 0) {
    console.error(`\n--- ${name} FAILED ---`);
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }

  return { name, ok: exitCode === 0, duration };
}

function fmt(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function main(): Promise<void> {
  const totalStart = performance.now();

  // Phase 1: Independent static checks (parallel)
  console.log("Phase 1: Static checks (parallel)...");
  const phase1 = await Promise.all([
    run("lint", ["bun", "run", "lint"]),
    run("format:check", ["bun", "run", "format:check"]),
    run("check", ["bun", "run", "check"]),
    run("dead-code", ["bun", "run", "dead-code"]),
    run("audit", ["bun", "run", "audit"]),
  ]);

  for (const r of phase1) {
    const icon = r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${icon} ${r.name} (${fmt(r.duration)})`);
  }

  const phase1Failed = phase1.filter((r) => !r.ok);
  if (phase1Failed.length > 0) {
    console.error(`\n\x1b[31mPhase 1 failed: ${phase1Failed.map((r) => r.name).join(", ")}\x1b[0m`);
    process.exit(1);
  }

  // Phase 2: Tests with coverage
  console.log("\nPhase 2: Test with coverage...");
  const testResult = await run("test:coverage", ["bun", "run", "test:coverage"]);
  {
    const icon = testResult.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${icon} ${testResult.name} (${fmt(testResult.duration)})`);
  }
  if (!testResult.ok) {
    console.error("\n\x1b[31mPhase 2 failed: test:coverage\x1b[0m");
    process.exit(1);
  }

  // Phase 3: Build
  console.log("\nPhase 3: Build...");
  const buildResult = await run("build", ["bun", "run", "build"]);
  {
    const icon = buildResult.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${icon} ${buildResult.name} (${fmt(buildResult.duration)})`);
  }
  if (!buildResult.ok) {
    console.error("\n\x1b[31mPhase 3 failed: build\x1b[0m");
    process.exit(1);
  }

  const totalTime = performance.now() - totalStart;
  console.log(`\n\x1b[32mAll checks passed\x1b[0m in ${fmt(totalTime)}`);
}

main();
