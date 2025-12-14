/**
 * Test Gemini API Key
 * 
 * Usage: node scripts/test-gemini-key.js YOUR_API_KEY
 */

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('❌ Please provide API key as argument');
  console.log('Usage: node scripts/test-gemini-key.js YOUR_API_KEY');
  process.exit(1);
}

const models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'];

async function testModel(modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }],
        generationConfig: { maxOutputTokens: 50 }
      })
    });

    const data = await response.json();

    if (response.ok && data.candidates) {
      console.log(`✅ ${modelId}: Working`);
      return true;
    } else {
      console.log(`❌ ${modelId}: ${data.error?.message || 'Failed'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${modelId}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔑 Testing Gemini API Key...\n');

  for (const model of models) {
    await testModel(model);
  }

  console.log('\n✨ Done');
}

main();
