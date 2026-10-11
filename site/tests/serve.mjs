// Production preview (dist/) on 4341 for Playwright. P03 pattern (vite's API, in-process), wrapped in a
// restart-on-exit loop: other agents' cleanups on this shared machine can reap preview processes (ED #30).
// The child restarts on ANY exit (including a SIGTERM from someone else) unless this parent is shutting down.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv[2] === "--child") {
  const { preview } = await import("vite");
  const s = await preview({ preview: { port: 4341, strictPort: true } });
  s.printUrls();
} else {
  const self = fileURLToPath(import.meta.url);
  let child = null, shuttingDown = false;
  const run = () => {
    child = spawn(process.execPath, [self, "--child"], { stdio: "inherit" });
    child.on("exit", (code, sig) => {
      if (shuttingDown) return;
      console.error(`preview exited (${code ?? sig}); restarting`);
      setTimeout(run, 500);
    });
  };
  for (const s of ["SIGTERM", "SIGINT"]) process.once(s, () => { shuttingDown = true; child?.kill(s); process.exit(0); });
  run();
}
