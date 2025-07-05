const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// 简单的cookie解析器函数
function parseCookies(cookieString) {
  const cookies = {};
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

// 存储设备数据
let deviceData = {
  toilet_001: {
    deviceId: 'toilet_001',
    paperLow: false,
    trashFull: false,
    weightAlert: false,
    doorOpen: true,      // true = 门开启, false = 门关闭
    personDetected: false, // true = 检测到人, false = 没有人
    peopleCount: 0,
    co2Level: 450,
    tvocLevel: 120,
    occupied: false,     // 占用状态：门关闭 && 检测到人
    occupancyTimeout: false,
    occupiedDuration: 0,
    occupancyMessage: '',
    lastUpdate: new Date().toISOString(),
    timestamp: Date.now()
  }
};

// 用户认证 (与ESP32完全相同)
const users = [
  { username: 'admin', password: 'admin12345', role: 'admin' },
  { username: 'user', password: '12345', role: 'user' }
];

let sessions = {}; // 存储会话

// 计算占用状态的函数 (与ESP32逻辑一致)
function calculateOccupied(doorOpen, personDetected) {
  // 占用条件：门关闭 (!doorOpen) 且 检测到人 (personDetected)
  return !doorOpen && personDetected;
}

// 认证中间件
function requireAuth(req, res, next) {
  const sessionToken = req.headers['session-token'] || 
                      req.query.session || 
                      req.cookies?.sessionToken;
  
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

// 登录页面 (与ESP32完全相同)
function getLoginPageHTML(error = '') {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>EEE4464 EA Project - Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #f0f8f0 0%, #e8f5e8 100%);
            color: #2d5a2d;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 4px 20px rgba(76, 175, 80, 0.15);
            border: 3px solid #4CAF50;
            max-width: 400px;
            width: 100%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .project-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            letter-spacing: 1px;
            color: #4CAF50;
        }
        
        h1 {
            font-size: 1.8em;
            margin-bottom: 8px;
            color: #2d5a2d;
        }
        
        .subtitle {
            font-size: 14px;
            color: #666;
        }
        
        .cloud-badge {
            background: #2196F3;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            margin-top: 5px;
            display: inline-block;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #2d5a2d;
        }
        
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input[type="text"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: #4CAF50;
        }
        
        .btn {
            width: 100%;
            background: #4CAF50;
            border: none;
            color: white;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .btn:hover {
            background: #45a049;
            transform: translateY(-2px);
        }
        
        .error {
            color: #f44336;
            text-align: center;
            margin-bottom: 20px;
            font-weight: bold;
            padding: 10px;
            background: #ffebee;
            border-radius: 5px;
            border: 1px solid #f44336;
        }
        
        .demo-info {
            margin-top: 20px;
            padding: 15px;
            background: #f8fcf8;
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
            font-size: 14px;
        }
        
        .demo-info h4 {
            margin-bottom: 8px;
            color: #2d5a2d;
        }
        
        .demo-info p {
            margin: 4px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="header">
            <div class="project-title">EEE4464 EA PROJECT</div>
            <h1>🚽 Smart Toilet Monitor</h1>
            <div class="subtitle">Please login to continue</div>
            <div class="cloud-badge">☁️ Cloud Version</div>
        </div>
        
        ${error ? `<div class="error">${error}</div>` : ''}
        
        <form method="POST" action="/login">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="btn">🔑 Login</button>
        </form>
        
        <div class="demo-info">
            <h4>📋 Demo Accounts:</h4>
            <p><strong>Admin:</strong> admin / admin12345</p>
            <p><strong>User:</strong> user / 12345</p>
        </div>
    </div>
</body>
</html>`;
}

// API路由

// 接收ESP32传感器数据
app.post('/api/sensor-data', (req, res) => {
  const data = req.body;
  const deviceId = data.deviceId || 'toilet_001';
  
  console.log(`📡 Received data from ${deviceId}:`, data);
  
  // 解析数据，确保类型正确
  const doorOpen = Boolean(data.doorOpen);
  const personDetected = Boolean(data.personDetected);
  const peopleCount = parseInt(data.peopleCount) || 0;
  
  // 根据peopleCount更新personDetected状态
  const actualPersonDetected = peopleCount > 0 ? true : personDetected;
  
  // 计算占用状态 (门关闭 && 检测到人)
  const occupied = calculateOccupied(doorOpen, actualPersonDetected);
  
  console.log(`🚪 Door: ${doorOpen ? 'Open' : 'Closed'}`);
  console.log(`👤 Person detected: ${actualPersonDetected}`);
  console.log(`👥 People count: ${peopleCount}`);
  console.log(`🚻 Occupied: ${occupied}`);
  
  // 存储数据
  deviceData[deviceId] = {
    deviceId: deviceId,
    paperLow: Boolean(data.paperLow),
    trashFull: Boolean(data.trashFull),
    weightAlert: Boolean(data.weightAlert),
    doorOpen: doorOpen,
    personDetected: actualPersonDetected,
    peopleCount: peopleCount,
    co2Level: parseInt(data.co2Level) || 0,
    tvocLevel: parseInt(data.tvocLevel) || 0,
    occupied: occupied,
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
    deviceId: deviceId,
    occupied: occupied
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

// 用户登录 (表单提交)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log(`🔐 Login attempt: ${username}`);
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessions[sessionToken] = {
      username: user.username,
      role: user.role,
      loginTime: new Date().toISOString()
    };
    
    console.log(`✅ User ${username} logged in successfully with role ${user.role}`);
    
    // 设置cookie并重定向到主页
    res.setHeader('Set-Cookie', `sessionToken=${sessionToken}; Path=/; Max-Age=${24 * 60 * 60}; HttpOnly=false`);
    res.redirect('/dashboard');
  } else {
    console.log(`❌ Failed login attempt for: ${username}`);
    res.send(getLoginPageHTML('Invalid credentials! Please try again.'));
  }
});

// API登录 (JSON)
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
    
    console.log(`👤 API User ${username} logged in with role ${user.role}`);
    
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
app.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.sessionToken;
  
  if (sessionToken && sessions[sessionToken]) {
    console.log(`👤 User ${sessions[sessionToken].username} logged out`);
    delete sessions[sessionToken];
  }
  
  res.setHeader('Set-Cookie', 'sessionToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.redirect('/');
});

// 检查认证状态
function checkAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.sessionToken;
  
  if (!sessionToken || !sessions[sessionToken]) {
    return res.send(getLoginPageHTML());
  }
  
  req.user = sessions[sessionToken];
  next();
}

// 重置警报
app.post('/api/reset', (req, res) => {
  console.log('🔄 Resetting all alerts for all devices');
  
  Object.keys(deviceData).forEach(deviceId => {
    const currentData = deviceData[deviceId];
    deviceData[deviceId] = {
      ...currentData,
      paperLow: false,
      trashFull: false,
      weightAlert: false,
      personDetected: false,
      peopleCount: 0,
      co2Level: 0,
      tvocLevel: 0,
      occupied: false, // 重置占用状态
      occupancyTimeout: false,
      occupiedDuration: 0,
      occupancyMessage: '',
      lastUpdate: new Date().toISOString()
    };
  });
  
  console.log('✅ All alerts reset to normal state');
  res.json({ success: true, message: 'Alerts reset' });
});

// 生成测试数据
app.post('/api/test', (req, res) => {
  console.log('🧪 Generating test data for all devices');
  
  Object.keys(deviceData).forEach(deviceId => {
    const doorOpen = false;      // 门关闭
    const personDetected = true; // 检测到人
    const peopleCount = 2;       // 2个人
    const occupied = calculateOccupied(doorOpen, personDetected); // 应该是true
    
    deviceData[deviceId] = {
      ...deviceData[deviceId],
      paperLow: true,
      trashFull: false,
      weightAlert: true,
      doorOpen: doorOpen,
      personDetected: personDetected,
      peopleCount: peopleCount,
      co2Level: 1200,
      tvocLevel: 3000,
      occupied: occupied,
      occupancyTimeout: true,
      occupiedDuration: 15000,
      occupancyMessage: '⚠️ Occupied for 30+ minutes!',
      lastUpdate: new Date().toISOString()
    };
    
    console.log(`🧪 Test data for ${deviceId}: Door=${doorOpen ? 'Open' : 'Closed'}, Person=${personDetected}, People=${peopleCount}, Occupied=${occupied}`);
  });
  
  console.log('✅ Test data generated for all devices');
  res.json({ success: true, message: 'Test data generated' });
});

// 主页 - 需要认证
app.get('/', checkAuth, (req, res) => {
  res.redirect('/dashboard');
});

// 仪表板页面
app.get('/dashboard', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 状态API - 需要认证
app.get('/api/status', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.sessionToken;
  
  if (!sessionToken || !sessions[sessionToken]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const deviceId = 'toilet_001';
  const data = deviceData[deviceId];
  
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    devices: Object.keys(deviceData).length,
    sessions: Object.keys(sessions).length
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
  console.log(`🔐 Login required for dashboard access`);
  console.log(`💾 Initial devices: ${Object.keys(deviceData).join(', ')}`);
  
  // 显示初始占用逻辑状态
  Object.entries(deviceData).forEach(([deviceId, data]) => {
    console.log(`📊 ${deviceId}: Door=${data.doorOpen ? 'Open' : 'Closed'}, Person=${data.personDetected}, Occupied=${data.occupied}`);
  });
  
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
