import { decodeFrame, searchPgn, listAllPgns } from "./pgn-db.js";
import http from "http";

const PORT = process.env.PORT || 8080;
let requestCount = 0;
let startTime = Date.now();

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

const routes = [
  { method: "GET", path: "/", handler: (q, res) => json(res, 200, { name: "CAN Diag API", version: "1.0.0", description: "Interpret raw CAN bus frames into human-readable diagnostics. J1939 PGN decoder + OBD-II support.", endpoints: { "/health": "GET - health check", "/decode": "POST - decode CAN frame", "/pgns/search": "GET - search PGN database", "/pgns/all": "GET - list all known PGNs" } }) },
  { method: "GET", path: "/health", handler: (q, res) => json(res, 200, { status: "healthy", uptime_ms: Date.now() - startTime, requests_served: requestCount, pgns_in_db: listAllPgns().length }) },
  { method: "GET", path: "/pgns/all", handler: (q, res) => json(res, 200, { count: listAllPgns().length, pgns: listAllPgns() }) },
  { method: "GET", path: "/pgns/search", handler: (q, res) => { const query = q.q || ""; if (!query) return json(res, 400, { error: "Missing ?q=<search> parameter" }); const results = searchPgn(query); return json(res, 200, { query, count: results.length, results }); } },
  { method: "POST", path: "/decode", handler: (body, res) => { if (!body.can_id || !body.data) return json(res, 400, { error: "Required: can_id (hex), data (hex bytes)" }); try { const result = decodeFrame(body.can_id, body.data); return json(res, 200, result); } catch (e) { return json(res, 400, { error: e.message }); } } },
  { method: "POST", path: "/batch-decode", handler: (body, res) => { if (!Array.isArray(body.frames)) return json(res, 400, { error: "Required: frames array of {can_id, data}" }); const results = body.frames.map(f => { try { return decodeFrame(f.can_id, f.data); } catch (e) { return { ...f, error: e.message }; } }); return json(res, 200, { count: results.length, results }); } },
  { method: "GET", path: "/stats", handler: (q, res) => json(res, 200, { uptime_seconds: ((Date.now()-startTime)/1000).toFixed(0), total_requests: requestCount, requests_per_minute: Math.round(requestCount / Math.max(1,(Date.now()-startTime)/60000)), pgns_indexed: listAllPgns().length }) },
];

const server = http.createServer((req, res) => {
  requestCount++;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = routes.find(r => r.method === req.method && url.pathname === r.path);
  
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  if (route) {
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try { route.handler(JSON.parse(body || "{}"), res); } catch(e) { json(res, 400, { error: "Invalid JSON: " + e.message }); }
      });
    } else {
      route.handler(url.searchParams, res);
    }
  } else {
    json(res, 404, { error: "Not found: " + req.method + " " + url.pathname });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.error(`[CAN-Diag-API] Listening on port ${PORT}`);
  console.error(`[CAN-Diag-API] Health: http://localhost:${PORT}/health`);
  console.error(`[CAN-Diag-API] Docs: http://localhost:${PORT}/`);
});
