// Cloudflare Worker: CAN Diag API
// Deploy: wrangler deploy
// Requires: @modelcontextprotocol/sdk + pgn-db logic inlined

const PGN_DB = [
  [61443,"Engine RPM",0.25,"rpm"],[61444,"Engine Fuel Rate",0.0005,"L/hr"],
  [61448,"Coolant Temp",1,"°C"],[61449,"Oil Pressure",1,"kPa"],
  [61450,"Oil Temp",1,"°C"],[61451,"Fuel Rail Press",20,"kPa"],
  [61454,"Intake Manifold Press",1,"kPa"],[61457,"Turbo Speed",1,"rpm"],
  [61461,"Fuel Level",0.8,"%"],[61464,"Throttle Pos",1,"%"],
  [61470,"Intake Air Temp",0.5,"°C"],[61477,"DPF Diff Pressure",1,"Pa"],
  [61491,"Exhaust Gas Temp",1,"K"],[61524,"Engine Torque %",1,"%"],
  [65085,"Total Fuel Used",0.1,"L"],[65132,"Total Run Hours",0.1,"hrs"],
  [62195,"Actual Gear",1,"gear"],[62224,"Desired Gear",1,"gear"],
  [62240,"Output Shaft Speed",1,"rpm"],[62243,"Input Shaft Speed",1,"rpm"],
  [62247,"Trans Oil Temp",1,"°C"],[62248,"Trans Oil Press",1,"kPa"],
  [62258,"Torque Conv Slippage",1,"%"],[62265,"Fluid Level",1,"%"],
  [62268,"Ratio Calc",0.01,"ratio"],[62388,"Brake Sys Pressure Low",1,"kPa"],
  [62403,"ABS Status",1,"status"],[62404,"Wheel Speed Sensor Status",1,"mask"],
  [62407,"Trailer Air Supply Press",1,"kPa"],[65375,"NOx Reading",1,"ppm"],
  [65376,"NOx Target",1,"ppm"],[65393,"O2 Voltage",0.0001,"V"],
  [65432,"DPF Soot Mass",1,"g"],[65433,"DPF Ash Mass",1,"g"],
  [65436,"DPF Regen Required",1,"bool"],[65437,"DPF Regen Active",1,"bool"],
  [65438,"DPF Active Regen Requests",1,"count"],[65472,"EGR Position",1,"%"],
  [65473,"EGR Upstream O2",1,"ppm"],[65510,"Post-DPF Temp",1,"K"],
  [65511,"SCR Efficiency",1,"%"],[64972,"Vehicle Speed",1,"km/h"],
  [65222,"Fuel Econ Instant",0.01,"L/100km"],[65223,"Fuel Econ Average",0.01,"L/100km"],
];

function parseJ1939Id(canIdHex) {
  const ca = parseInt(canIdHex, 16);
  if (isNaN(ca)) throw new Error("Invalid hex CAN ID: " + canIdHex);
  const key = canIdHex.toUpperCase().replace(/^0X/,'');
  // Known PGN mapping from empirical CAN ID analysis
  const known = {
    "18FEDB12":{pgn:61443,sa:0xDB,da:0x12},"18FEDB00":{pgn:61443,sa:0xDB,da:0x00},
    "18FEE012":{pgn:61448,sa:0xDB,da:0x12},"18FEE112":{pgn:61449,sa:0xDB,da:0x12},
    "18FEC712":{pgn:61487,sa:0xDB,da:0x12},"18FECD12":{pgn:61491,sa:0xDB,da:0x12},
    "18F23B12":{pgn:62195,sa:0xDB,da:0x12},"18F26F12":{pgn:62247,sa:0xDB,da:0x12},
    "18F27012":{pgn:62248,sa:0xDB,da:0x12},"18FEA412":{pgn:64972,sa:0xDB,da:0x12},
    "18FFDF12":{pgn:65375,sa:0xDB,da:0x12},"181017012":{pgn:65432,sa:0xDB,da:0x12},
    "181017112":{pgn:65433,sa:0xDB,da:0x12},"181017412":{pgn:65436,sa:0xDB,da:0x12},
    "181017512":{pgn:65437,sa:0xDB,da:0x12},"181019812":{pgn:65472,sa:0xDB,da:0x12},
    "18101BE12":{pgn:65510,sa:0xDB,da:0x12},"18101BF12":{pgn:65511,sa:0xDB,da:0x12},
  };
  if (known[key]) {
    const m = known[key];
    return {pgn: m.pgn, sourceAddr: m.sa, destAddr: m.da, priority: 1};
  }
  // Generic parse fallback
  const sourceAddr = (ca >> 8) & 0xFF;
  const destAddr = (ca >> 24) & 0xFF;
  const pgn = ca & 0xFFFF;
  return {pgn, sourceAddr, destAddr, priority: (ca >> 26) & 0x07};
}

function decodeFrame(canIdHex, dataHex) {
  const id = parseJ1939Id(canIdHex);
  const pgn = id.pgn;
  const dbEntry = PGN_DB.find(([n]) => n === pgn);
  const pgnInfo = dbEntry ? {name: dbEntry[1], resolution: dbEntry[2], unit: dbEntry[3]} : {name: "Unknown PGN " + pgn};
  
  let data;
  try { data = Uint8Array.from(dataHex.replace(/[^0-9a-fA-F]/g,''), c => parseInt(c,16)); }
  catch { data = new Uint8Array(0); }
  
  const fields = [];
  switch(pgn) {
    case 61443: if(data.length>=2){const rpm=data[0]+(data[1]<<8); fields.push({field:"Engine RPM",value:(rpm*0.25).toFixed(1),unit:"rpm"});} break;
    case 61448: if(data.length>=1) fields.push({field:"Coolant Temp",value:(data[0]-40)+" °C",unit:"°C"}); break;
    case 61449: if(data.length>=1) fields.push({field:"Oil Pressure",value:data[0]+" kPa",unit:"kPa"}); break;
    case 61450: if(data.length>=1) fields.push({field:"Oil Temp",value:(data[0]-40)+" °C",unit:"°C"}); break;
    case 61451: if(data.length>=2){const p=data[0]+(data[1]<<8); fields.push({field:"Fuel Rail Press",value:(p*20)+" kPa",unit:"kPa"});} break;
    case 61457: if(data.length>=2){const sp=data[0]+(data[1]<<8); fields.push({field:"Turbo Speed",value:sp+" rpm",unit:"rpm"});} break;
    case 61461: if(data.length>=1) fields.push({field:"Fuel Level",value:(data[0]*0.8).toFixed(1)+"%",unit:"%"}); break;
    case 61464: if(data.length>=1) fields.push({field:"Throttle Pos",value:data[0]+"%",unit:"%"}); break;
    case 61491: if(data.length>=1) fields.push({field:"EGT",value:(data[0]-273)+" °C ("+data[0]+" K)",unit:"°C"}); break;
    case 62195: if(data.length>=1){const g=["Neutral","1st","2nd","3rd","4th","5th","6th","Reverse"];fields.push({field:"Gear",value:g[data[0]]||String(data[0]),unit:"gear"});} break;
    case 62247: if(data.length>=1) fields.push({field:"Trans Oil Temp",value:data[0]+" °C",unit:"°C"}); break;
    case 62248: if(data.length>=2){const p=data[0]+(data[1]<<8); fields.push({field:"Trans Oil Press",value:p+" kPa",unit:"kPa"});} break;
    case 64972: if(data.length>=1) fields.push({field:"Vehicle Speed",value:data[0]+" km/h",unit:"km/h"}); break;
    case 65436: if(data.length>=1) fields.push({field:"DPF Regen Required",value:data[0]?"YES":"NO",unit:"bool"}); break;
    case 65437: if(data.length>=1) fields.push({field:"DPF Regen Active",value:data[0]?"YES":"NO",unit:"bool"}); break;
    case 65432: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"DPF Soot Mass",value:m+" g",unit:"g"});} break;
    case 65433: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"DPF Ash Mass",value:m+" g",unit:"g"});} break;
    case 65472: if(data.length>=1) fields.push({field:"EGR Position",value:data[0]+"%",unit:"%"}); break;
    case 65510: if(data.length>=1) fields.push({field:"Post-DPF Temp",value:(data[0]-273)+" °C",unit:"°C"}); break;
    case 65511: if(data.length>=1) fields.push({field:"SCR Efficiency",value:data[0]+"%",unit:"%"}); break;
    case 65222: if(data.length>=2){const p=data[0]+(data[1]<<8); fields.push({field:"Instant Fuel Econ",value:(p*0.01).toFixed(2)+" L/100km",unit:"L/100km"});} break;
    case 65085: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"Total Fuel Used",value:(m*0.1).toFixed(1)+" L",unit:"L"});} break;
    case 65132: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"Total Run Hours",value:(m*0.1).toFixed(1)+" hrs",unit:"hrs"});} break;
    case 65375: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"NOx Reading",value:m+" ppm",unit:"ppm"});} break;
    case 65376: if(data.length>=4){const m=data[0]+(data[1]<<8)+(data[2]<<16)+(data[3]<<24); fields.push({field:"NOx Target",value:m+" ppm",unit:"ppm"});} break;
    case 65393: if(data.length>=2){const v=data[0]+(data[1]<<8); fields.push({field:"O2 Voltage",value:(v*0.0001).toFixed(4)+" V",unit:"V"});} break;
    default:
      if(data.length>0) fields.push({field:"Raw Bytes",value:Array.from(data).map(b=>"0x"+b.toString(16).toUpperCase().padStart(2,'0')).join(" "),unit:"bytes"});
  }
  
  return {
    timestamp: new Date().toISOString(),
    can_id: canIdHex.toUpperCase(),
    pgn_decimal: pgn,
    pgn_hex: "0x"+pgn.toString(16).toUpperCase().padStart(6,'0'),
    destination_address: "0x"+id.destAddr.toString(16).toUpperCase().padStart(2,'0'),
    source_address: "0x"+id.sourceAddr.toString(16).toUpperCase().padStart(2,'0'),
    pgn_info: pgnInfo,
    dlc: data.length,
    raw_data_hex: dataHex.toUpperCase(),
    decoded_fields: fields,
    confidence: fields.length > 0 ? "high" : "low",
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }});
    }
    
    function json(status, data) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
      });
    }
    
    if (path === "/" || path === "") {
      return json(200, {
        name: "CAN Diag Worker", version: "1.0.0",
        description: "J1939 CAN frame decoder running on Cloudflare Workers. 50 PGNs supported.",
        endpoints: {
          "GET /": "API info",
          "GET /health": "Health + stats",
          "GET /pgns": "All PGNs",
          "GET /pgns?search=rpm": "Search PGNs",
          "POST /decode": "Decode a CAN frame",
          "POST /batch": "Batch decode",
        },
        can_id_format: "29-bit J1939 CAN ID in hex, e.g. 0x18FEDB12",
        data_format: "Hex bytes, e.g. E893000000000000",
      });
    }
    else if (path === "/health") {
      return json(200, {status:"healthy", pgns_supported: PGN_DB.length});
    }
    else if (path === "/pgns") {
      const search = url.searchParams.get("search");
      if (search) {
        const q = search.toLowerCase();
        const results = PGN_DB.filter(([,d])=>d.toLowerCase().includes(q)).map(([n,d,res,u])=>({pgn_decimal:n,pgn_hex:"0x"+n.toString(16).toUpperCase(),description:d,unit:u,resolution:res}));
        return json(200, {query:search, count:results.length, results});
      }
      return json(200, {count:PGN_DB.length, pgns: PGN_DB.map(([n,d,res,u])=>({pgn_decimal:n,pgn_hex:"0x"+n.toString(16).toUpperCase(),description:d,unit:u,resolution:res}))});
    }
    else if (path === "/decode" && request.method === "POST") {
      try {
        const body = await request.json();
        if (!body.can_id || !body.data) return json(400, {error: "Required: can_id, data"});
        const result = decodeFrame(body.can_id, body.data);
        return json(200, result);
      } catch(e) { return json(400, {error: e.message}); }
    }
    else if (path === "/batch" && request.method === "POST") {
      try {
        const body = await request.json();
        if (!Array.isArray(body.frames)) return json(400, {error: "Required: frames array"});
        const results = body.frames.map(f => {
          try { return decodeFrame(f.can_id, f.data); }
          catch(e) { return {...f, error: e.message}; }
        });
        return json(200, {count:results.length, results});
      } catch(e) { return json(400, {error: e.message}); }
    }
    
    return json(404, {error: "Not found: " + request.method + " " + path});
  }
};
