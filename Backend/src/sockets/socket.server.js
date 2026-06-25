const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

const userModel = require("../models/user.model");
const aiService = require("../service/ai.service");
const messageModel = require("../models/message.model");
const { createMemory, queryMemory } = require("../service/vector.service");

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:5173", "https://cohort-1-project-chat-gpt.onrender.com"],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const cookies = cookie.parse(
      socket.handshake.headers?.cookie || ""
    );

    if (!cookies.token) {
      return next(
        new Error("Authentication error: No Token Provided")
      );
    }

    try {
      const decoded = jwt.verify(
        cookies.token,
        process.env.JWT_SECRET
      );

      const user = await userModel.findById(decoded.id);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;

      next();
    } catch (err) {
      return next(
        new Error("Authentication error: Invalid token")
      );
    }
  });

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.user.email);

    socket.on("ai-message", async (messagePayload) => {
      try {
        if (typeof messagePayload === "string") {
          messagePayload = JSON.parse(messagePayload);
        }


        const [message, vectors] = await Promise.all([
          messageModel.create({
            chat: messagePayload.chat,
            user: socket.user._id,
            content: messagePayload.content,
            role: "user"
          }),
          aiService.generateVector(messagePayload.content)
        ]);

        await createMemory({
          vectors,
          messageId: message._id,
          metadata: {
            chat: messagePayload.chat,
            user: socket.user._id.toString(),
            text: messagePayload.content,
            role: "user",
          },
        });


        const [memory, chatHistoryRaw] = await Promise.all([
          queryMemory({
            queryVector: vectors,
            limit: 10,
            metadata: {
              user: socket.user._id.toString(),
            },
          }),
          messageModel
            .find({ chat: messagePayload.chat })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
            .then((arr) => (Array.isArray(arr) ? arr.reverse() : [])),
        ]);

        const chatHistory = chatHistoryRaw || [];

        const memoryContext = (memory || [])
          .filter((item) => item.score > 0.6)
          .map((item) => item.metadata?.text?.slice(0, 500) || "")
          .join("\n\n");






        // BUILD PROMPT


        const prompt = `
You are an AI assistant with long-term memory.

Retrieved memories from previous conversations:

${memoryContext}

Current conversation:

${chatHistory
            .map(item => `${item.role}: ${item.content}`)
            .join("\n")}

User's latest question:
${messagePayload.content}

Answer using the retrieved memories if relevant.
Do not say you cannot remember previous conversations when relevant memories are available.
`;

        const response = await aiService.generateResponse(prompt);



        const responseMessage = await messageModel.create({
          chat: messagePayload.chat,
          user: socket.user._id,
          content: response,
          role: "model",
        });

        socket.emit("ai-response", {
          content: response,
          chat: messagePayload.chat,
          createdAt: responseMessage.createdAt,
        });
        console.log("Emitting AI Response:", response);

        // Run vector memory generation in the background so it doesn't block response delivery
        aiService.generateVector(response).then((responseVectors) => {
          return createMemory({
            vectors: responseVectors,
            messageId: responseMessage._id,
            metadata: {
              chat: messagePayload.chat,
              user: socket.user._id.toString(),
              text: response,
              role: "model",
            },
          });
        }).catch(err => {
          console.error("Failed to generate memory for AI response:", err);
        });
      } catch (error) {
        console.error(
          "Socket AI Error:",
          error
        );

        socket.emit("ai-response", {
          content:
            "Something went wrong. Please try again.",
          chat: messagePayload?.chat,
        });
      }
    });
  });

}

module.exports = initSocketServer;