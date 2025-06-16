#!/usr/bin/env node

/**
 * OpenBlock Agent 服务验证脚本
 * 检查 Link Server 和 Resource Server 是否正常启动并响应
 */

const http = require('http');
const { WebSocket } = require('ws');

// 服务配置
const SERVICES = {
  link: {
    name: 'OpenBlock Link Server',
    host: '127.0.0.1',
    port: 20111,
    type: 'websocket',
    endpoints: ['/scratch/ble', '/scratch/serialport']
  },
  resource: {
    name: 'OpenBlock Resource Server', 
    host: '0.0.0.0',
    port: 20120,
    type: 'http',
    endpoints: ['/extensions/en.json', '/devices/en.json']
  }
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

// HTTP 请求检查
function checkHttpService(service) {
  return new Promise((resolve) => {
    const options = {
      hostname: service.host === '0.0.0.0' ? 'localhost' : service.host,
      port: service.port,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      resolve({
        success: true,
        status: res.statusCode,
        message: `HTTP ${res.statusCode}`
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.code || error.message,
        message: error.message
      });
    });

    req.on('timeout', () => {
      resolve({
        success: false,
        error: 'TIMEOUT',
        message: '连接超时'
      });
    });

    req.end();
  });
}

// WebSocket 连接检查
function checkWebSocketService(service) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://${service.host}:${service.port}/scratch/ble`);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve({
          success: false,
          error: 'TIMEOUT',
          message: '连接超时'
        });
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: true,
          message: 'WebSocket 连接成功'
        });
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.code || 'CONNECTION_ERROR',
          message: error.message
        });
      });

    } catch (error) {
      resolve({
        success: false,
        error: 'WEBSOCKET_ERROR',
        message: error.message
      });
    }
  });
}

// 检查端口是否被占用
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    
    server.listen(port, (err) => {
      if (err) {
        resolve(true); // 端口被占用
      } else {
        server.once('close', () => resolve(false));
        server.close();
      }
    });
    
    server.on('error', () => {
      resolve(true); // 端口被占用
    });
  });
}

// 主验证函数
async function verifyServices() {
  log('🔍 OpenBlock Agent 服务状态检查', colors.bright + colors.blue);
  log('='.repeat(50), colors.blue);
  
  for (const [key, service] of Object.entries(SERVICES)) {
    log(`\n📡 检查 ${service.name}`, colors.bright);
    log(`   地址: ${service.host}:${service.port}`, colors.blue);
    
    // 检查端口占用
    const portInUse = await checkPortInUse(service.port);
    if (!portInUse) {
      log(`   ❌ 端口 ${service.port} 未被占用 - 服务可能未启动`, colors.red);
      continue;
    } else {
      log(`   ✅ 端口 ${service.port} 正在被使用`, colors.green);
    }
    
    // 检查服务响应
    let result;
    if (service.type === 'http') {
      result = await checkHttpService(service);
    } else if (service.type === 'websocket') {
      result = await checkWebSocketService(service);
    }
    
    if (result.success) {
      log(`   ✅ 服务响应正常: ${result.message}`, colors.green);
      
      // 测试具体端点
      if (service.type === 'http') {
        log(`   🧪 测试端点:`, colors.yellow);
        for (const endpoint of service.endpoints) {
          try {
            const testResult = await checkHttpEndpoint(service.host === '0.0.0.0' ? 'localhost' : service.host, service.port, endpoint);
            if (testResult.success) {
              log(`      ✅ ${endpoint} - ${testResult.message}`, colors.green);
            } else {
              log(`      ❌ ${endpoint} - ${testResult.message}`, colors.red);
            }
          } catch (error) {
            log(`      ❌ ${endpoint} - ${error.message}`, colors.red);
          }
        }
      }
    } else {
      log(`   ❌ 服务无响应: ${result.message}`, colors.red);
      log(`      错误代码: ${result.error}`, colors.yellow);
    }
  }
  
  // 总结
  log('\n🎯 验证总结', colors.bright + colors.blue);
  log('='.repeat(50), colors.blue);
  log('如果服务正常运行，你应该能看到:', colors.blue);
  log('• Link Server (端口 20111) - 提供硬件通信服务', colors.blue);
  log('• Resource Server (端口 20120) - 提供扩展和设备资源', colors.blue);
  log('');
  log('💡 测试网址:', colors.yellow);
  log('• Resource Server: http://localhost:20120/extensions/en.json', colors.yellow);
  log('• Resource Server: http://localhost:20120/devices/en.json', colors.yellow);
}

// 检查HTTP端点
function checkHttpEndpoint(host, port, endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: endpoint,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({
              success: true,
              message: `HTTP 200, 数据: ${Object.keys(json).length} 项`
            });
          } catch (e) {
            resolve({
              success: true,
              message: `HTTP 200, 数据长度: ${data.length} 字节`
            });
          }
        } else {
          resolve({
            success: false,
            message: `HTTP ${res.statusCode}`
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        message: error.message
      });
    });

    req.on('timeout', () => {
      resolve({
        success: false,
        message: '请求超时'
      });
    });

    req.end();
  });
}

// 运行验证
if (require.main === module) {
  verifyServices().catch(console.error);
}

module.exports = { verifyServices, SERVICES }; 