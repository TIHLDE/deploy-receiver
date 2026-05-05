import http from "http";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";

const TOKEN = process.env.DEPLOY_TOKEN;
const HOST = "192.168.0.41";
const PORT = 4040;

if (!TOKEN) {
  console.error("DEPLOY_TOKEN is not set. Exiting.");
  process.exit(1);
}

const running = new Set();

/**
 * Simple structured logger
 */
function log(repo, message, meta = "") {
  const time = new Date().toISOString();
  if (meta && typeof meta === "object") {
    console.log(`[${time}] [${repo}] ${message}`, JSON.stringify(meta));
  } else {
    console.log(`[${time}] [${repo}] ${message}`, meta);
  }
}

const server = http.createServer((req, res) => {
  log("system", `Incoming request ${req.method} ${req.url}`);

  if (req.method !== "POST" || req.url !== "/deploy") {
    res.writeHead(404).end();
    return;
  }

  if (req.headers["x-deploy-token"] !== TOKEN) {
    log("system", "Unauthorized request rejected");
    res.writeHead(401).end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    return;
  }

  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", () => {
    let payload;

    try {
      payload = JSON.parse(body);
    } catch (err) {
      log("system", "Invalid JSON received", body);
      res.writeHead(400).end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
      return;
    }

    const { repo, image, deliveryId } = payload;

    if (!repo || !image || !deliveryId) {
      log(repo || "system", "Missing required fields", payload);
      res.writeHead(400).end(JSON.stringify({ ok: false, error: "Missing fields" }));
      return;
    }

    const script = `/home/debian/apps/${repo}/deploy.sh`;

    if (!fs.existsSync(script)) {
      log(repo, `Deploy script not found at ${script}`);
      res.writeHead(404).end(JSON.stringify({ ok: false, error: "Deploy script not found" }));
      return;
    }

    if (running.has(repo)) {
      log(repo, "Deploy skipped (already running)", { deliveryId });
      res.writeHead(409).end(JSON.stringify({ ok: false, error: "Deploy already in progress" }));
      return;
    }

    running.add(repo);

    log(repo, "Deploy accepted", { image, deliveryId, script });

    res.writeHead(200).end(JSON.stringify({ ok: true }));

    const child = execFile(script, [image, deliveryId], {
      cwd: path.dirname(script),
    });

    child.stdout.on("data", (data) => {
      process.stdout.write(`[${repo}] ${data}`);
    });

    child.stderr.on("data", (data) => {
        process.stderr.write(`[${repo}] ${data}`);
    });

    child.on("exit", (code) => {
      running.delete(repo);

      if (code === 0) {
        log(repo, "Deploy finished successfully", { deliveryId });
      } else {
        log(repo, "Deploy failed", { code, deliveryId });
      }
    });

    child.on("error", (err) => {
      running.delete(repo);
      log(repo, "Failed to start deploy process", err.message);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Deploy server listening on ${HOST}:${PORT}`);
});
