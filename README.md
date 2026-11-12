# can-diag-api

J1939 CAN bus frame decoder — API + worker + MCP server. 50 PGNs. Zero deps.

## Run locally
```bash
node src/server.js        # REST API on port 8080
```

## Test
```bash
curl -X POST http://localhost:8080/decode \
  -H "Content-Type: application/json" \
  -d '{"can_id":"0x18FEDB12","data":"E893000000000000"}'
```

## Deploy to Cloudflare Workers
```bash
# 1. Create free Cloudflare account
# 2. wrangler login
# 3. wrangler deploy --config cloudflare-worker.js
```

## Deploy to Railway / Fly.io
```bash
# Railway: connect this repo → zero config, starts with node src/server.js
# Fly.io: fly launch + fly deploy
```

## Cloudflare Worker (zero-dependency, single file)
See `cloudflare-worker.js` — deploys as a single file, no npm install needed.

## PGN Database
50 SAE J1939 PGNs covering:
- Engine: RPM, coolant/oil temp/pressure, fuel rail, turbo speed, EGT, torque
- Transmission: gear, shaft speed, oil temp/pressure, TC slippage
- Brakes/Chassis: brake pressure, ABS status, axle weight, trailer air
- Emissions: NOx, O2, DPF soot/ash/regen, EGR, SCR efficiency
- Vehicle: speed, fuel economy, runtime

## License
MIT
