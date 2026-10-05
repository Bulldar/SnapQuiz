// SnapQuiz server: serves the phone page and solves camera frames with Claude.
// On Render it just listens on $PORT (Render provides HTTPS).
// On your PC it also opens a free HTTPS tunnel so the phone camera works.
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import qrcode from "qrcode-terminal";

const ON_RENDER = !!process.env.RENDER || process.platform !== "win32";
const PORT = Number(process.env.PORT) || 3434;
// Keeps strangers off your API key. Set ACCESS_KEY to keep the same link across restarts.
const KEY = process.env.ACCESS_KEY || crypto.randomBytes(6).toString("hex");
const CLOUDFLARED = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const PAGE = fs.readFileSync(new URL("./index.html", import.meta.url));

const client = new Anthropic();

const SYSTEM = `You read photos taken by a phone camera pointed at a screen or paper showing a question or problem.
Find the single main question (the most prominent / centered one) and solve it.
- Multiple choice: answer with the letter, then a dash and the choice text, e.g. "B - 42".
- Otherwise: give only the final answer, as short as possible (a number, word, or short phrase).
- If no question is readable (blurry, cut off, nothing there), set found to false.
"question" is a short (under 15 words) summary of the question, used to tell questions apart.`;

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    question: { type: "string" },
    answer: { type: "string" },
  },
  required: ["found", "question", "answer"],
  additionalProperties: false,
};

async function solve(imageB64) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } },
          { type: "text", text: "Answer the question in this photo." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") return { found: false, question: "", answer: "" };
  const text = response.content.find((b) => b.type === "text")?.text;
  return text ? JSON.parse(text) : { found: false, question: "", answer: "" };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(PAGE);
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    return res.end("ok");
  }
  if (req.method === "POST" && req.url === "/solve") {
    if (req.headers["x-key"] !== KEY) {
      res.writeHead(403);
      return res.end("bad key");
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const { image } = JSON.parse(Buffer.concat(chunks).toString());
      const result = await solve(image);
      if (result.found) console.log(`  OK  ${result.question}  ->  ${result.answer}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    } catch (err) {
      console.error("  ERROR solve failed:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  if (ON_RENDER) {
    if (!process.env.ACCESS_KEY) console.log("WARNING: ACCESS_KEY not set - the link below changes every deploy.");
    console.log(`SnapQuiz is live: ${process.env.RENDER_EXTERNAL_URL || ""}/?k=${KEY}`);
    return;
  }
  console.log(`\nSnapQuiz running on http://localhost:${PORT} - opening a secure link for your phone...\n`);
  startTunnel();
});

function showLink(link) {
  console.log("=====================================================");
  console.log("  SCAN THIS WITH YOUR PHONE CAMERA:\n");
  qrcode.generate(link, { small: true }, (q) => console.log(q));
  console.log(`  or open: ${link}`);
  console.log("=====================================================");
}

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED)) {
    console.log("cloudflared not found - install it with:  winget install Cloudflare.cloudflared");
    return;
  }
  const tunnel = spawn(CLOUDFLARED, [
    "tunnel", "--edge-ip-version", "4", "--no-autoupdate", "--url", `http://localhost:${PORT}`,
  ]);
  let shown = false;
  const onData = (buf) => {
    const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m || shown) return;
    shown = true;
    showLink(`${m[0]}/?k=${KEY}`);
    console.log("  (link can take ~20 seconds to start working)\n");
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
  tunnel.on("exit", (code) => console.log(`Tunnel stopped (code ${code}). Restart SnapQuiz to get a new link.`));
  process.on("exit", () => tunnel.kill());
  process.on("SIGINT", () => process.exit());
}
