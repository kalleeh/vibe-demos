#!/usr/bin/env node
/* clinic-admin — local PocketBase for tests.
   Downloads pocketbase_0.40.2_<os>_<arch>.zip into /tmp/pb-clinic-test/ once, then serves a FRESH pb_data
   (wiped on every start) with this demo's migrations + hooks on http://127.0.0.1:8095.

     node clinic-admin/tools/pb-local.mjs            → starts, prints the URL, keeps running (Ctrl-C stops)
     import { startLocalPB } from "./pb-local.mjs"   → { url, stop(), reset(), log() } for tools/e2e.mjs

   The 0.40.2 pin mirrors the shared server binary (see .claude/rules/pocketbase.md). A throw-away superuser
   (e2e@clinic.local, random password, never printed) is upserted non-interactively BEFORE `serve`: without one
   PocketBase opens its "create your first superuser" installer in the default browser on every fresh start. The app
   itself never uses it — everything goes through the collection rules + pb_hooks/identity.pb.js, as in production.
   The child process is killed on stop(), on process exit and on SIGINT/SIGTERM (also after a failed run). */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const PB_VERSION = "0.40.2";
const DIR = "/tmp/pb-clinic-test";
const PORT = 8095;
const URL_ = `http://127.0.0.1:${PORT}`;
const MIGRATIONS = resolve(here, "..", "pb", "pb_migrations");
const HOOKS = resolve(here, "..", "pb", "pb_hooks");
const SU_EMAIL = "e2e@clinic.local";

function platformZip() {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : null;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : null;
  if (!os || !arch) throw new Error(`pb-local: unsupported platform ${process.platform}/${process.arch}`);
  return `pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
}

function ensureBinary() {
  mkdirSync(DIR, { recursive: true });
  const bin = join(DIR, "pocketbase");
  if (existsSync(bin)) {
    const v = spawnSync(bin, ["--version"], { encoding: "utf8" }).stdout || "";
    if (v.includes(PB_VERSION)) return bin;
    rmSync(bin, { force: true });
  }
  const zip = platformZip();
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zip}`;
  console.log(`pb-local: downloading ${url}`);
  const dl = spawnSync("curl", ["-sSL", "-o", join(DIR, zip), url], { encoding: "utf8" });
  if (dl.status !== 0) throw new Error("pb-local: download failed " + dl.stderr);
  const un = spawnSync("unzip", ["-o", "-q", join(DIR, zip), "pocketbase", "-d", DIR], { encoding: "utf8" });
  if (un.status !== 0) throw new Error("pb-local: unzip failed " + un.stderr);
  rmSync(join(DIR, zip), { force: true });
  return bin;
}

async function waitHealth(url, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url + "/api/health"); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

const children = new Set();
const killAll = () => { for (const c of children) { try { c.kill("SIGKILL"); } catch {} } children.clear(); };
process.on("exit", killAll);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { killAll(); process.exit(130); });

/* Starts a fresh instance. `quiet` hides PB's own stdout (the e2e keeps it for failures via log()). */
export async function startLocalPB({ quiet = true } = {}) {
  const bin = ensureBinary();
  const data = join(DIR, "pb_data");
  const common = ["--dir", data, "--migrationsDir", MIGRATIONS, "--hooksDir", HOOKS, "--dev=false"];
  let child = null, log = [];
  // The e2e's server-side scan (every sync_blob payload is ciphertext) reads the collections as this superuser — the
  // credentials stay in memory, are handed back to the caller only, and change on every start.
  const superuser = { email: SU_EMAIL, password: "pb" + randomBytes(16).toString("hex") };
  const boot = async () => {
    rmSync(data, { recursive: true, force: true });
    mkdirSync(data, { recursive: true });
    // Throw-away superuser first → no installer tab in the user's browser (see the header). Never printed.
    // hex + a letter prefix: a base64url value can start with "-" and be parsed as a flag by the CLI.
    const su = spawnSync(bin, ["superuser", "upsert", SU_EMAIL, superuser.password, ...common], { encoding: "utf8" });
    if (su.status !== 0) throw new Error("pb-local: superuser upsert failed\n" + (su.stderr || su.stdout));
    child = spawn(bin, ["serve", ...common, "--http", `127.0.0.1:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    child.once("exit", () => children.delete(child));
    log = [];
    const keep = (buf) => { const s = String(buf); log.push(s); if (log.length > 200) log.shift(); if (!quiet) process.stdout.write(s); };
    child.stdout.on("data", keep); child.stderr.on("data", keep);
    if (!(await waitHealth(URL_))) { try { child.kill("SIGKILL"); } catch {} throw new Error("pb-local: PocketBase did not come up\n" + log.join("")); }
  };
  const stop = async () => {
    if (!child) return;
    const c = child; child = null;
    await new Promise((res) => { c.once("exit", res); c.kill("SIGTERM"); setTimeout(() => { try { c.kill("SIGKILL"); } catch {} res(); }, 3000); });
  };
  await boot();
  return { url: URL_, superuser, stop, reset: async () => { await stop(); await boot(); }, log: () => log.join("") };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pb = await startLocalPB({ quiet: false });
  console.log(`pb-local: ${pb.url}  (fresh pb_data · migrations ${MIGRATIONS} · hooks ${HOOKS})`);
  const bye = async () => { await pb.stop(); process.exit(0); };
  process.on("SIGINT", bye); process.on("SIGTERM", bye);
}
