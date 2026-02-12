const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function test() {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-3.0-flash"]; 
  
  console.log("Starting tests...");
  const model15 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Test 1.5 first to confirm key works
  try {
      await model15.generateContent("hi");
      console.log("1.5-flash: OK");
  } catch(e) { console.log("1.5-flash: FAIL " + e.message.split('\n')[0]); }

  for (const m of models.slice(1)) {
      try {
          const model = genAI.getGenerativeModel({ model: m });
          await model.generateContent("hi");
          console.log(`${m}: OK`);
      } catch (e) {
          console.log(`${m}: FAIL ${e.message.split('\n')[0]}`); // split to keep it short
      }
  }
}

test();
