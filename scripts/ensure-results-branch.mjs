#!/usr/bin/env node
/**
 * One-time setup: create the `run-results` branch (pointed at current main)
 * that the run-job workflow publishes redacted job responses to. Sandboxed
 * sessions read them via the GitHub contents API, since Actions log downloads
 * are not reachable from the sandbox egress allowlist.
 */
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN required");
const repo = "TheAnteGame/App";
const H = {
  Authorization: `token ${token}`,
  "User-Agent": "ante-build",
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
};
const main = await (await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers: H })).json();
const existing = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/run-results`, { headers: H });
if (existing.ok) {
  console.log("run-results branch already exists");
} else {
  const r = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ ref: "refs/heads/run-results", sha: main.object.sha }),
  });
  console.log(r.ok ? "run-results branch created" : `failed: ${r.status} ${await r.text()}`);
}
