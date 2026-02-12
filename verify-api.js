const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verify() {
  console.log("🔍 Checking environment...");
  
  // 1. Read .env.local manually since dotenv might not be installed
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (match && match[1]) {
          apiKey = match[1].trim().replace(/["']/g, ''); // Remove quotes if present
          console.log("✅ Found GEMINI_API_KEY in .env.local");
        }
      }
    } catch (err) {
      console.error("⚠️ Error reading .env.local:", err.message);
    }
  }

  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not found in process.env or .env.local");
    return;
  }

  // 2. Initialize Gemini
  console.log("🚀 Testing Gemini API connection...");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // 3. Test Models (Stable first)
  const modelsToTest = ["gemini-1.5-flash", "gemini-2.0-flash"];
  
  for (const modelName of modelsToTest) {
    console.log(`\n----------------------------------------`);
    console.log(`🧪 Testing model: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello.");
      const response = await result.response;
      console.log(`✅ Success! Model ${modelName} is working.`);
      console.log(`📝 Response preview: ${response.text().substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed: ${modelName}`);
      // Log full error structure for debugging
      if (error.response) {
         console.error("Status:", error.response.status);
         console.error("Status Text:", error.response.statusText);
      }
      console.error("Error Message:", error.message);
      // Try to print detailed error if available
      try {
        console.error("Full Details:", JSON.stringify(error, null, 2));
      } catch (e) {}
    }
  }
}

verify();
