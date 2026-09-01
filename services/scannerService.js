import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const clients = [];
const activePorts = new Map();

const SCANNER_CONFIG = [
  { path: "COM4", mode: "IN" },
  { path: "COM5", mode: "OUT" },
];

function sendEvent(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach((res) => res.write(data));
}

function broadcastStatus(event) {
  sendEvent({
    eventType: "scanner-status",
    ...event,
    timestamp: new Date().toISOString(),
  });
}

function createScannerConnection(portPath, mode) {
  const port = new SerialPort({
    path: portPath,
    baudRate: 9600,
    autoOpen: true,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\r" }));

  const scanner = {
    port,
    parser,
    mode,
    path: portPath,
  };

  port.on("open", () => {
    console.log(`${mode} scanner connected on ${portPath}`);
    broadcastStatus({
      status: "connected",
      scannerPort: portPath,
      type: mode,
    });
  });

  port.on("error", (err) => {
    console.error(`${mode} scanner error on ${portPath}:`, err.message);
  });

  port.on("close", () => {
    console.log(`${mode} scanner disconnected from ${portPath}`);
    activePorts.delete(portPath);

    broadcastStatus({
      status: "disconnected",
      scannerPort: portPath,
      type: mode,
    });
  });

  port.on("data", (chunk) => {
    // console.log(`${mode} RAW:`, chunk, "=>", chunk.toString());
  });

  parser.on("data", (raw) => {
    const code = String(raw).trim();
    if (!code) return;

    const event = {
      eventType: "scan",
      type: mode,
      code,
      scannerPort: portPath,
      timestamp: new Date().toISOString(),
    };

    sendEvent(event);
  });

  return scanner;
}

async function syncScanners() {
  try {
    const ports = await SerialPort.list();
    const availablePaths = new Set(ports.map((p) => p.path));

    for (const config of SCANNER_CONFIG) {
      const { path, mode } = config;

      const isAvailable = availablePaths.has(path);
      const isActive = activePorts.has(path);

      if (isAvailable && !isActive) {
        console.log(`Found ${mode} scanner on ${path}, connecting...`);
        const scanner = createScannerConnection(path, mode);
        activePorts.set(path, scanner);
      }

      if (!isAvailable && isActive) {
        console.log(`${mode} scanner missing on ${path}, cleaning up...`);
        const scanner = activePorts.get(path);

        try {
          scanner.parser.removeAllListeners();
          scanner.port.removeAllListeners();

          if (scanner.port.isOpen) {
            scanner.port.close();
          }
        } catch (err) {
          console.error(`Cleanup failed for ${path}:`, err.message);
        }

        activePorts.delete(path);

        broadcastStatus({
          status: "disconnected",
          scannerPort: path,
          type: mode,
        });
      }
    }
  } catch (err) {
    console.error("Scanner sync error:", err.message);
  }
}

export function registerScanStream(app) {
  app.get("/scans/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(
      `data: ${JSON.stringify({
        eventType: "server",
        message: "scanner stream connected",
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    clients.push(res);

    req.on("close", () => {
      const index = clients.indexOf(res);
      if (index !== -1) clients.splice(index, 1);
    });
  });
}

export function startScanners() {
  syncScanners();
  setInterval(syncScanners, 2000);
}