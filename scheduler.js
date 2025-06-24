const cron = require('node-cron');
const rssService = require('./services/rssParser');
const recommendationService = require('./services/recommendationService');

console.log('Starting news scheduler...');

cron.schedule('*/30 * * * *', async () => {
  console.log('Running scheduled news fetch...');
  
  try {
    const articles = await rssService.fetchAllFeeds();
    await rssService.saveArticles(articles);
    
    console.log(`Scheduled fetch completed: ${articles.length} articles processed`);
    
    await recommendationService.updateArticleScores();
    console.log('Article scores updated');
    
  } catch (error) {
    console.error('Error in scheduled fetch:', error);
  }
});

cron.schedule('0 * * * *', async () => {
  console.log('Running hourly recommendation score update...');
  
  try {
    await recommendationService.updateArticleScores();
    console.log('Hourly score update completed');
  } catch (error) {
    console.error('Error in hourly score update:', error);
  }
});

console.log('Scheduler initialized:');
console.log('- News fetch: every 30 minutes');
console.log('- Score update: every hour');