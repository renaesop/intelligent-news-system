const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define test execution order for optimal performance
    const testOrder = [
      'setup.test.js',
      'api.test.js',
      'integration.test.js',
      'vector-service.test.js',
      'recall-ranking.test.js',
      'edge-cases.test.js',
      'performance.test.js' // Run performance tests last
    ];

    return tests.sort((testA, testB) => {
      const indexA = testOrder.findIndex(name => testA.path.includes(name));
      const indexB = testOrder.findIndex(name => testB.path.includes(name));

      // If test is not in predefined order, run it after ordered tests
      const orderA = indexA === -1 ? testOrder.length : indexA;
      const orderB = indexB === -1 ? testOrder.length : indexB;

      return orderA - orderB;
    });
  }
}

module.exports = CustomSequencer;