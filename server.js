const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();

// Simple CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Serve the frontend UI files from the /public folder
app.use(express.static('public'));

let carSocket = null;

// Basic health check & status
app.get('/', (req, res) => {
  res.send({ status: carSocket ? 'online' : 'offline' });
});

const server = createServer(app);

// Single WebSocket server handling both Car and Drivers based on path
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  if (req.url === '/car') {
    // This is the ESP32 Car
    console.log('[CAR] Connected');
    if (carSocket && carSocket.readyState === carSocket.OPEN) {
      console.log('[CAR] Booting old car connection');
      carSocket.close();
    }
    carSocket = ws;
    
    ws.on('message', (message) => {
      // Forward car telemetry/responses to all drivers
      wss.clients.forEach(client => {
        if (client !== carSocket && client.readyState === client.OPEN) {
          client.send(message);
        }
      });
    });

    ws.on('close', () => {
      console.log('[CAR] Disconnected');
      if (carSocket === ws) carSocket = null;
    });

  } else {
    // This is a Driver (Frontend UI)
    console.log('[DRIVER] Connected');
    
    ws.on('message', (message) => {
      // Forward driver commands directly to the car
      if (carSocket && carSocket.readyState === carSocket.OPEN) {
        carSocket.send(message);
      }
    });

    ws.on('close', () => {
      console.log('[DRIVER] Disconnected');
    });
  }
});

server.listen(PORT, () => {
  console.log(`Cloud Relay running on port ${PORT}`);
});
