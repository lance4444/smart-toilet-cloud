const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 存储设备数据 (生产环境建议使用数据库)
let deviceData = {};

// WebSocket服务器用于实时更新
const wss = new WebSocket.Server({ port: 8080 });

// API路由
app.post('/api/sensor-data', (req, res) => {
  const data = req.body;
  const deviceId = data.deviceId;
  
  // 存储数据
  deviceData[deviceId] = {
    ...data,
    lastUpdate: new Date().toISOString()
  };
  
  console.log(`📡 Received data from ${deviceId}:`, data);
  
  // 广播给所有连接的客户端
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'sensor-update',
        deviceId,
        data: deviceData[deviceId]
      }));
    }
  });
  
  res.json({ success: true, message: 'Data received' });
});

app.get('/api/devices', (req, res) => {
  res.json(deviceData);
});

app.get('/api/device/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  const data = deviceData[deviceId];
  
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// 提供主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Cloud server running on port ${PORT}`);
});
