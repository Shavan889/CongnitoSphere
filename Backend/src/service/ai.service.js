const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({});

async function generateResponse(content) {
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: content,
        config: {
          temperature: 0.2,
          systemInstruction: "You are a helpful assistant for a chat application. Provide concise and relevant responses to user messages.",
        }
      });

      return response.text;
    } catch (err) {
      console.log(`Retry ${i + 1} failed`);

      if (i === maxRetries - 1) {
        throw err;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000 * (i + 1))
      );
    }
  }
}

async function generateVector(content) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: content,
    config: {
      outputDimensionality: 768,
    },
  });

  return response.embeddings[0].values;
}

module.exports = {
  generateResponse,
  generateVector,
};
