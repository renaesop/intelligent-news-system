#!/usr/bin/env node

/**
 * Enhanced Test Runner for My-News System
 * Runs organized test suites with better reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 启动智能新闻系统测试');
console.log('=====================================');

// 测试配置
const testConfig = {
  timeout: 30000,
  verbose: true,
  coverage: true,
  maxWorkers: '50%'
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

// 测试套件定义
const testSuites = {
  unit: {
    name: '单元测试',
    pattern: 'tests/unit/**/*.test.js',
    timeout: 10000
  },
  integration: {
    name: '集成测试', 
    pattern: 'tests/integration/**/*.test.js',
    timeout: 20000
  },
  performance: {
    name: '性能测试',
    pattern: 'tests/performance/**/*.test.js',
    timeout: 60000
  }
};

async function runTestSuite(suiteName, config) {
  log(`\n📋 运行 ${config.name}...`, 'blue');
  
  return new Promise((resolve, reject) => {
    const args = [
      '--testPathPattern', config.pattern,
      '--maxWorkers', testConfig.maxWorkers,
      '--verbose'
    ];
    
    if (testConfig.coverage && suiteName === 'unit') {
      args.push('--coverage');
    }
    
    const child = spawn('npm', ['test', '--', ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${config.name} 通过`, 'green');
        resolve(true);
      } else {
        log(`❌ ${config.name} 失败 (退出代码: ${code})`, 'red');
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      log(`❌ ${config.name} 运行错误: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function runAllTests() {
  const results = {};
  
  log('🔍 检查测试环境...', 'yellow');
  
  // 检查Jest配置
  if (!fs.existsSync('jest.config.js')) {
    log('❌ 未找到 jest.config.js', 'red');
    process.exit(1);
  }
  
  log('✅ 测试环境检查完成', 'green');
  
  // 运行各个测试套件
  for (const [suiteName, config] of Object.entries(testSuites)) {
    try {
      results[suiteName] = await runTestSuite(suiteName, config);
    } catch (error) {
      results[suiteName] = false;
      log(`❌ ${config.name} 执行异常: ${error.message}`, 'red');
    }
  }
  
  // 输出总结
  log('\n📊 测试结果总结:', 'blue');
  log('===================', 'blue');
  
  let totalPassed = 0;
  let totalSuites = Object.keys(results).length;
  
  for (const [suiteName, passed] of Object.entries(results)) {
    const config = testSuites[suiteName];
    const status = passed ? '✅ 通过' : '❌ 失败';
    const color = passed ? 'green' : 'red';
    
    log(`${config.name}: ${status}`, color);
    
    if (passed) totalPassed++;
  }
  
  log(`\n总计: ${totalPassed}/${totalSuites} 套件通过`, totalPassed === totalSuites ? 'green' : 'yellow');
  
  if (totalPassed === totalSuites) {
    log('🎉 所有测试套件都通过了！', 'green');
    process.exit(0);
  } else {
    log('⚠️  部分测试套件失败，请检查上述输出', 'yellow');
    process.exit(1);
  }
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
用法: node tests/scripts/test-runner.js [选项]

选项:
  --help, -h     显示帮助信息
  --unit         只运行单元测试
  --integration  只运行集成测试
  --performance  只运行性能测试
  --coverage     生成覆盖率报告 (默认开启)

示例:
  node tests/scripts/test-runner.js              # 运行所有测试
  node tests/scripts/test-runner.js --unit       # 只运行单元测试
  node tests/scripts/test-runner.js --integration # 只运行集成测试
  `);
  process.exit(0);
}

// 根据参数运行特定测试套件
if (args.includes('--unit')) {
  runTestSuite('unit', testSuites.unit);
} else if (args.includes('--integration')) {
  runTestSuite('integration', testSuites.integration);
} else if (args.includes('--performance')) {
  runTestSuite('performance', testSuites.performance);
} else {
  runAllTests();
}