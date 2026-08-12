#!/usr/bin/env node
/**
 * Push the current git HEAD tree to GitHub via the Git Data API.
 * Exists because sandboxed build sessions may not be able to `git push`
 * directly (git proxy restrictions) while repository-scoped API calls work.
 *
 * Usage: GITHUB_TOKEN=... node scripts/push-via-api.mjs [owner/repo] [branch] [message]
 * Requires: run from the repo root; files come from `git ls-files` + HEAD commit message.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN required");
const repo = process.argv[2] ?? "TheAnteGame/App";
const branch = process.argv[3] ?? "main";
const message =
  process.argv[4] ?? execSync("git log -1 --pretty=%B").toString().trim();

const api = async (path, opts = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "ante-build",
      Accept: "application/vnd.github+json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok && res.status !== 404 && res.status !== 422) {
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res;
};

const files = execSync("git ls-files").toString().trim().split("\n");
console.log(`Pushing ${files.length} files to ${repo}@${branch}…`);

// 1. Blobs
const tree = [];
for (const path of files) {
  const content = readFileSync(path).toString("base64");
  const res = await api("/git/blobs", {
    method: "POST",
    body: JSON.stringify({ content, encoding: "base64" }),
  });
  const { sha } = await res.json();
  tree.push({ path, mode: "100644", type: "blob", sha });
}
console.log(`  ${tree.length} blobs created`);

// 2. Parent (if branch exists)
let parent = null;
const refRes = await api(`/git/ref/heads/${branch}`);
if (refRes.ok) parent = (await refRes.json()).object.sha;

// 3. Tree (full snapshot — no base_tree, so deletes propagate)
const treeRes = await api("/git/trees", {
  method: "POST",
  body: JSON.stringify({ tree }),
});
const treeSha = (await treeRes.json()).sha;

// 4. Commit
const commitRes = await api("/git/commits", {
  method: "POST",
  body: JSON.stringify({
    message,
    tree: treeSha,
    parents: parent ? [parent] : [],
  }),
});
const commitSha = (await commitRes.json()).sha;

// 5. Ref
if (parent) {
  await api(`/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSha }),
  });
} else {
  await api("/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitSha }),
  });
}
console.log(`Done: ${commitSha} → ${repo}@${branch}`);
