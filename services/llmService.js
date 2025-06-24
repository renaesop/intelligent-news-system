const OpenAI = require('openai');
require('dotenv').config();

class LLMService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyzeArticle(article) {
    try {
      const prompt = `
        Analyze the following news article and extract key information:
        
        Title: ${article.title}
        Description: ${article.description}
        Content: ${article.content.substring(0, 1000)}...
        
        Please provide:
        1. Main topics (max 5 keywords)
        2. Sentiment (positive/negative/neutral)
        3. Importance score (0-10)
        4. Brief summary (max 50 words)
        
        Format the response as JSON.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a news analysis assistant. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;
    } catch (error) {
      console.error('Error analyzing article:', error);
      return {
        topics: [],
        sentiment: 'neutral',
        importance: 5,
        summary: article.description.substring(0, 100)
      };
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000)
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  async calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async extractKeywords(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'Extract 3-5 key topics/keywords from the text. Return only a JSON array of strings.' 
          },
          { role: 'user', content: text.substring(0, 1000) }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }
}

module.exports = new LLMService();