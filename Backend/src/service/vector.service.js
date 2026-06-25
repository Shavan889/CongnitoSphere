const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const chatGptIndex = pc.index("chatgpt");

async function createMemory({ vectors, metadata, messageId }) {
  if (!Array.isArray(vectors) || vectors.length === 0) {
    throw new Error("Invalid vectors");
  }

  const record = {
    id: String(messageId),
    values: vectors,
    metadata: {
      chat: String(metadata.chat),
      user: String(metadata.user),
      text: String(metadata.text),
    },
  };

  console.log("Upserting record:", record.id);

  await chatGptIndex.upsert({
    records: [record],
  });

  console.log("Upsert success");
}

async function queryMemory({
  queryVector,
  limit = 5,
  metadata = {},
}) {
  const queryOptions = {
    vector: queryVector,
    topK: limit,
    includeMetadata: true,
  };

  const filter = {};

  if (metadata.user) {
    filter.user = {
      $eq: String(metadata.user),
    };
  }

  if (metadata.chat) {
    filter.chat = {
      $eq: String(metadata.chat),
    };
  }

  if (Object.keys(filter).length > 0) {
    queryOptions.filter = filter;
  }

  const data = await chatGptIndex.query(
    queryOptions
  );

  return data.matches || [];
}

module.exports = { createMemory, queryMemory };
