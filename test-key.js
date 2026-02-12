const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyDY4seglctJ6TNQlNJTWDdmoNay9VJDJHM");

async function test() {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-2.0-flash"]; 
  
  console.log("Starting tests with hardcoded key...");

  for (const m of models) {
      try {
          const model = genAI.getGenerativeModel({ model: m });
          await model.generateContent("hi");
          console.log(`${m}: OK`);
      } catch (e) {
          console.log(`${m}: FAIL ${e.message.split('\n')[0]}`);
      }
  }
}

test();
