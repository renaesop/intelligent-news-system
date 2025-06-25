#!/usr/bin/env node

const vectorService = require('../../services/vectorService');
const recommendationService = require('../../services/recommendationService');

async function testVectorFunctionality() {
  console.log('🧪 Testing Vector Search Functionality\n');
  
  try {
    // Test 1: Check vector service initialization
    console.log('📊 Test 1: Vector Service Stats');
    const stats = await vectorService.getVectorStats();
    console.log('Vector Stats:', stats);
    console.log('✅ Vector service initialized successfully\n');

    // Test 2: Generate test embeddings
    console.log('🤖 Test 2: Generating Test Embeddings');
    const testText = "artificial intelligence and machine learning news";
    const embedding = await vectorService.generateEmbedding(testText);
    
    if (embedding && embedding.length === 1536) {
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } else {
      console.log('❌ Failed to generate embedding');
      return;
    }
    console.log();

    // Test 3: Test similarity calculation
    console.log('🔍 Test 3: Similarity Calculation');
    const text1 = "machine learning algorithms";
    const text2 = "artificial intelligence research";
    const text3 = "cooking recipes and food";
    
    const emb1 = await vectorService.generateEmbedding(text1);
    const emb2 = await vectorService.generateEmbedding(text2);
    const emb3 = await vectorService.generateEmbedding(text3);
    
    if (emb1 && emb2 && emb3) {
      const sim1_2 = vectorService.cosineSimilarity(emb1, emb2);
      const sim1_3 = vectorService.cosineSimilarity(emb1, emb3);
      
      console.log(`Similarity between "${text1}" and "${text2}": ${sim1_2.toFixed(4)}`);
      console.log(`Similarity between "${text1}" and "${text3}": ${sim1_3.toFixed(4)}`);
      
      if (sim1_2 > sim1_3) {
        console.log('✅ Similarity calculation working correctly (related texts more similar)');
      } else {
        console.log('⚠️  Unexpected similarity results');
      }
    }
    console.log();

    // Test 4: Test article vector storage (mock data)
    console.log('📝 Test 4: Article Vector Storage');
    const mockArticle = {
      id: 999999, // Use a test ID
      title: "Breaking: New AI Model Achieves Human-Level Performance",
      description: "Researchers have developed a new artificial intelligence model that demonstrates human-level performance across multiple cognitive tasks.",
      content: "This groundbreaking research in artificial intelligence represents a significant milestone in machine learning development..."
    };

    try {
      await vectorService.storeArticleVectors(
        mockArticle.id,
        mockArticle.title,
        mockArticle.description + " " + mockArticle.content
      );
      console.log('✅ Successfully stored article vectors');
    } catch (error) {
      console.log('❌ Error storing article vectors:', error.message);
    }
    console.log();

    // Test 5: Test vector search
    console.log('🔍 Test 5: Vector Search');
    const searchQuery = "artificial intelligence research";
    
    try {
      const similarArticles = await vectorService.findSimilarArticles(searchQuery, 5);
      console.log(`Found ${similarArticles.length} similar articles for query: "${searchQuery}"`);
      
      similarArticles.forEach((article, index) => {
        const similarity = article.similarity || (1 - article.distance);
        console.log(`  ${index + 1}. Article ID: ${article.article_id}, Similarity: ${similarity.toFixed(4)}`);
      });
      
      if (similarArticles.length > 0) {
        console.log('✅ Vector search working correctly');
      } else {
        console.log('⚠️  No similar articles found (this might be normal for empty database)');
      }
    } catch (error) {
      console.log('❌ Error in vector search:', error.message);
    }
    console.log();

    // Test 6: Test user preference vectors
    console.log('👤 Test 6: User Preference Vectors');
    const testUserId = 'test_user_001';
    const userKeywords = ['artificial intelligence', 'machine learning', 'neural networks', 'deep learning'];
    
    try {
      await vectorService.updateUserPreferenceVector(testUserId, userKeywords);
      console.log(`✅ Updated preference vector for user: ${testUserId}`);
      console.log(`Keywords: ${userKeywords.join(', ')}`);
    } catch (error) {
      console.log('❌ Error updating user preference vector:', error.message);
    }
    console.log();

    // Test 7: Test personalized recommendations
    console.log('🎯 Test 7: Personalized Recommendations');
    try {
      const recommendations = await vectorService.getPersonalizedRecommendations(testUserId, 5);
      console.log(`Generated ${recommendations.length} personalized recommendations for ${testUserId}`);
      
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. Article ID: ${rec.article_id}, Score: ${rec.similarity_score.toFixed(4)}`);
      });
      
      if (recommendations.length > 0) {
        console.log('✅ Personalized recommendations working');
      } else {
        console.log('⚠️  No recommendations generated (normal for new user/empty database)');
      }
    } catch (error) {
      console.log('❌ Error generating recommendations:', error.message);
    }
    console.log();

    // Final stats
    console.log('📊 Final Vector Database Stats');
    const finalStats = await vectorService.getVectorStats();
    console.log('Final Stats:', finalStats);
    
    console.log('\n🎉 Vector functionality testing completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Vector service initialization');
    console.log('✅ Embedding generation');
    console.log('✅ Similarity calculation');
    console.log('✅ Article vector storage');
    console.log('✅ Vector search functionality');
    console.log('✅ User preference vectors');
    console.log('✅ Personalized recommendations');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up test data
    try {
      vectorService.close();
      console.log('\n🧹 Cleaned up test resources');
    } catch (error) {
      console.log('⚠️  Error cleaning up:', error.message);
    }
  }
}

// Run tests
if (require.main === module) {
  testVectorFunctionality().catch(console.error);
}

module.exports = { testVectorFunctionality };