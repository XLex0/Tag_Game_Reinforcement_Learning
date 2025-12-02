// serverTCP.js (o server.js)
import net from "net";
import { reset, step, context } from "./envHeadless.js";

const argPort = process.argv.find(a => /^\d+$/.test(a));
const port = Number(process.env.PORT ?? argPort ?? 7777);

const server = net.createServer(sock => {
  sock.setEncoding("utf8");
  let buf = "";

  sock.on("data", chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); 
      buf = buf.slice(i + 1);
      try {
        const msg = JSON.parse(line);
        if (msg.cmd === "reset") {
          const r = reset(msg.seed);
          sock.write(JSON.stringify(r) + "\n");
        } else if (msg.cmd === "step") {
          const r = step(msg, msg.n || 1, msg.dt || 0.01);
          sock.write(JSON.stringify(r) + "\n");
        } else if (msg.cmd === "context") {
          const r = context();
          sock.write(JSON.stringify(r) + "\n");
        } else {
          sock.write(JSON.stringify({ error: "badcmd" }) + "\n");
        }
      } catch (e) {
        sock.write(JSON.stringify({ error: "parse", detail: String(e) }) + "\n");
      }
    }
  });

  // <<< AÑADIR ESTO >>>
  sock.on("error", err => {
    console.error("Socket error:", err.code, err.message);
    // no relanzamos el error para que no se caiga el proceso
  });

  sock.on("close", () => {
    // opcional, por si quieres verlo en consola
    console.log("Client disconnected");
  });
});

server.on("error", err => {
  console.error("Server error:", err);
});

server.listen(port, "127.0.0.1", () =>
  console.log(`RL TCP on 127.0.0.1:${port}`)
);

export default server;
