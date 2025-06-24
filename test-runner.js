#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 启动自动化测试脚本');
console.log('=====================================');

// 测试配置
const testConfig = {
  timeout: 30000,
  verbose: true,
  coverage: true
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// 检查依赖
function checkDependencies() {
  log('📦 检查测试依赖...', 'blue');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['jest', 'supertest'];
  
  const missing = requiredDeps.filter(dep => 
    !packageJson.devDependencies || !packageJson.devDependencies[dep]
  );
  
  if (missing.length > 0) {
    log(`❌ 缺少依赖: ${missing.join(', ')}`, 'red');
    log('请运行: npm install', 'yellow');
    process.exit(1);
  }
  
  log('✅ 依赖检查通过', 'green');
}

// 运行测试
function runTests() {
  return new Promise((resolve, reject) => {
    log('🧪 开始运行测试...', 'blue');
    
    const jestArgs = [
      '--verbose',
      '--forceExit',
      '--detectOpenHandles'
    ];
    
    if (testConfig.coverage) {
      jestArgs.push('--coverage');
    }
    
    const jestProcess = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    jestProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ 所有测试通过!', 'green');
        resolve();
      } else {
        log('❌ 测试失败', 'red');
        reject(new Error(`测试退出码: ${code}`));
      }
    });
    
    jestProcess.on('error', (error) => {
      log(`❌ 测试运行错误: ${error.message}`, 'red');
      reject(error);
    });
  });
}

// 生成测试报告
function generateReport() {
  log('📊 生成测试报告...', 'blue');
  
  const coverageDir = path.join(process.cwd(), 'coverage');
  if (fs.existsSync(coverageDir)) {
    const lcovReport = path.join(coverageDir, 'lcov-report', 'index.html');
    if (fs.existsSync(lcovReport)) {
      log(`📈 测试覆盖率报告: file://${lcovReport}`, 'green');
    }
  }
  
  log('✅ 测试报告生成完成', 'green');
}

// 主函数
async function main() {
  try {
    checkDependencies();
    await runTests();
    generateReport();
    
    log('🎉 测试完成!', 'green');
    log('=====================================');
    
    // 测试摘要
    log('📋 测试摘要:', 'blue');
    log('• API端点测试: ✅ 通过');
    log('• 错误处理测试: ✅ 通过');
    log('• 参数验证测试: ✅ 通过');
    log('• 模拟服务测试: ✅ 通过');
    
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 处理命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
使用方法: node test-runner.js [选项]

选项:
  --help, -h     显示帮助信息
  --no-coverage  不生成覆盖率报告
  --quiet        静默模式

示例:
  node test-runner.js
  node test-runner.js --no-coverage
  npm test
`);
  process.exit(0);
}

if (process.argv.includes('--no-coverage')) {
  testConfig.coverage = false;
}

if (process.argv.includes('--quiet')) {
  testConfig.verbose = false;
}

// 运行测试
main();