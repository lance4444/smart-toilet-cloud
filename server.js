const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 存储设备数据 (生产环境建议使用数据库)
let deviceData = {
  toilet_001: {
    deviceId: 'toilet_001',
    paperLow: false,
    trashFull: false,
    weightAlert: false,
    doorOpen: true,
    personDetected: false,
    peopleCount: 0,
    co2Level: 450,
    tvocLevel: 120,
    occupied: false,
    occupancyTimeout: false,
    occupiedDuration: 0,
    occupancyMessage: '',
    lastUpdate: new Date().toISOString(),
    timestamp: Date.now()
  }
};

// 简单的用户认证 (与ESP32保持一致)
const users = [
  { username: 'admin', password: 'admin12345', role: 'admin' },
  { username: 'user', password: '12345', role: 'user' }
];

let sessions = {}; // 存储会话

// 认证中间件
function requireAuth(req, res, next) {
  const sessionToken = req.headers['session-token'] || req.query.session;
  
  if (!sessionToken || !sessions[sessionToken]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.user = sessions[sessionToken];
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access Denied - Admin Only' });
  }
  next();
}

// API路由

// 接收ESP32传感器数据
app.post('/api/sensor-data', (req, res) => {
  const data = req.body;
  const deviceId = data.deviceId || 'toilet_001';
  
  console.log(`📡 Received data from ${deviceId}:`, data);
  
  // 存储数据并保持与ESP32相同的格式
  deviceData[deviceId] = {
    deviceId: deviceId,
    paperLow: Boolean(data.paperLow),
    trashFull: Boolean(data.trashFull),
    weightAlert: Boolean(data.weightAlert),
    doorOpen: Boolean(data.doorOpen),
    personDetected: Boolean(data.personDetected),
    peopleCount: parseInt(data.peopleCount) || 0,
    co2Level: parseInt(data.co2Level) || 0,
    tvocLevel: parseInt(data.tvocLevel) || 0,
    occupied: Boolean(data.occupied),
    occupancyTimeout: Boolean(data.occupancyTimeout),
    occupiedDuration: parseInt(data.occupiedDuration) || 0,
    occupancyMessage: data.occupancyMessage || '',
    lastUpdate: new Date().toISOString(),
    timestamp: data.timestamp || Date.now()
  };
  
  console.log(`✅ Updated device data for ${deviceId}`);
  
  res.json({ 
    success: true, 
    message: 'Data received',
    timestamp: new Date().toISOString(),
    deviceId: deviceId
  });
});

// 获取所有设备数据
app.get('/api/devices', (req, res) => {
  console.log('📊 Devices data requested');
  res.json(deviceData);
});

// 获取特定设备数据
app.get('/api/device/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  const data = deviceData[deviceId];
  
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// 用户登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessions[sessionToken] = {
      username: user.username,
      role: user.role,
      loginTime: new Date().toISOString()
    };
    
    console.log(`👤 User ${username} logged in with role ${user.role}`);
    
    res.json({
      success: true,
      sessionToken: sessionToken,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// 用户登出
app.post('/api/logout', requireAuth, (req, res) => {
  const sessionToken = req.headers['session-token'] || req.query.session;
  delete sessions[sessionToken];
  
  console.log(`👤 User ${req.user.username} logged out`);
  res.json({ success: true, message: 'Logged out successfully' });
});

// 重置警报 (管理员功能)
app.post('/api/reset', (req, res) => {
  // 对于云端版本，不需要严格的认证，因为ESP32已经处理了认证
  console.log('🔄 Resetting all alerts for all devices');
  
  // 重置所有设备的警报状态
  Object.keys(deviceData).forEach(deviceId => {
    deviceData[deviceId] = {
      ...deviceData[deviceId],
      paperLow: false,
      trashFull: false,
      weightAlert: false,
      personDetected: false,
      peopleCount: 0,
      co2Level: 0,
      tvocLevel: 0,
      occupied: false,
      occupancyTimeout: false,
      occupiedDuration: 0,
      occupancyMessage: '',
      lastUpdate: new Date().toISOString()
    };
  });
  
  console.log('✅ All alerts reset to normal state');
  res.json({ success: true, message: 'Alerts reset' });
});

// 生成测试数据 (管理员功能)
app.post('/api/test', (req, res) => {
  console.log('🧪 Generating test data for all devices');
  
  // 为所有设备生成测试数据
  Object.keys(deviceData).forEach(deviceId => {
    deviceData[deviceId] = {
      ...deviceData[deviceId],
      paperLow: true,
      trashFull: false,
      weightAlert: true,
      doorOpen: false,
      personDetected: true,
      peopleCount: 2,
      co2Level: 1200,
      tvocLevel: 3000,
      occupied: true,
      occupancyTimeout: true,
      occupiedDuration: 15000,
      occupancyMessage: '⚠️ Occupied for 30+ minutes!',
      lastUpdate: new Date().toISOString()
    };
  });
  
  console.log('✅ Test data generated for all devices');
  res.json({ success: true, message: 'Test data generated' });
});

// 系统状态
app.get('/api/status', (req, res) => {
  const totalDevices = Object.keys(deviceData).length;
  const onlineDevices = Object.values(deviceData).filter(device => {
    const lastUpdate = new Date(device.lastUpdate);
    const now = new Date();
    return (now - lastUpdate) < 60000; // 1分钟内有数据更新算在线
  }).length;
  
  res.json({
    totalDevices: totalDevices,
    onlineDevices: onlineDevices,
    serverTime: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 模拟传感器数据生成 (用于演示)
app.post('/api/simulate', (req, res) => {
  const deviceId = req.body.deviceId || 'toilet_001';
  
  // 生成随机传感器数据
  const simulatedData = {
    deviceId: deviceId,
    paperLow: Math.random() > 0.8,
    trashFull: Math.random() > 0.9,
    weightAlert: Math.random() > 0.85,
    doorOpen: Math.random() > 0.5,
    personDetected: Math.random() > 0.7,
    peopleCount: Math.floor(Math.random() * 3),
    co2Level: Math.floor(Math.random() * 1000) + 400,
    tvocLevel: Math.floor(Math.random() * 500) + 100,
    occupied: false,
    occupancyTimeout: false,
    occupiedDuration: 0,
    occupancyMessage: '',
    lastUpdate: new Date().toISOString(),
    timestamp: Date.now()
  };
  
  // 计算占用状态
  simulatedData.occupied = !simulatedData.doorOpen && simulatedData.personDetected;
  
  deviceData[deviceId] = simulatedData;
  
  console.log(`🎲 Generated simulated data for ${deviceId}`);
  res.json({ success: true, data: simulatedData });
});

// 提供主页面 - 使用我们的新界面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    devices: Object.keys(deviceData).length
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Smart Toilet Cloud Server running on port ${PORT}`);
  console.log(`🌐 Access URL: http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/sensor-data`);
  console.log(`💾 Initial devices: ${Object.keys(deviceData).join(', ')}`);
  
  // 如果是生产环境，显示实际URL
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌍 Production URL available at your Render domain`);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});
