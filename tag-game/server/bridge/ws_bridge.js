// server/bridge/ws_bridge.js
import { WebSocketServer } from "ws";
import net from "net";

const WS_PORT  = 8090;           // Browser <-> Node (WebSocket)
const TCP_HOST = "127.0.0.1";
const TCP_PORT = 7778;           // Node <-> MATLAB (TCP inference)

const wss = new WebSocketServer({ port: WS_PORT }, () =>
  console.log(`[WS] Escuchando ws://127.0.0.1:${WS_PORT}`)
);

wss.on("connection", (ws) => {
  console.log("[WS] Nuevo cliente");
  const sock = net.createConnection({ host: TCP_HOST, port: TCP_PORT }, () =>
    console.log("[TCP] Conectado a MATLAB 127.0.0.1:" + TCP_PORT)
  );

  let buf = "";
  sock.setEncoding("utf8");

  // TCP -> WS (MATLAB → Browser)
  sock.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { ws.send(line); } catch {}
    }
  });

  sock.on("error", (e) => {
    console.error("[TCP] Error:", e.message);
    try { ws.send(JSON.stringify({ error: "tcp", detail: e.message })); } catch {}
  });

  // WS -> TCP (Browser → MATLAB)
  ws.on("message", (data) => {
    try { sock.write(String(data).trim() + "\n"); }
    catch (e) { try { ws.send(JSON.stringify({ error: "write_tcp", detail: e.message })); } catch {} }
  });

  ws.on("close", () => { console.log("[WS] Cliente cerró"); sock.destroy(); });
});
