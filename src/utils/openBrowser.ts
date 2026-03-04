import { exec } from "node:child_process";

export function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${command} ${JSON.stringify(url)}`);
}
