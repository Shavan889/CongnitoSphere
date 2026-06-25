import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import ChatMobileBar from "../components/chat/ChatMobileBar.jsx";
import ChatSidebar from "../components/chat/ChatSidebar.jsx";
import ChatMessages from "../components/chat/ChatMessages.jsx";
import ChatComposer from "../components/chat/ChatComposer.jsx";
import "../components/chat/ChatLayout.css";
import { fakeAIReply } from "../components/chat/aiClient.js";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  ensureInitialChat,
  startNewChat,
  selectChat,
  setInput,
  sendingStarted,
  sendingFinished,
  addUserMessage,
  addAIMessage,
  setChats,
} from "../store/chatSlice.js";

const API_BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://cohort-1-project-chat-gpt.onrender.com";

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const chats = useSelector((state) => state.chat.chats);
  const activeChatId = useSelector((state) => state.chat.activeChatId);
  const input = useSelector((state) => state.chat.input);
  const isSending = useSelector((state) => state.chat.isSending);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [socket, setSocket] = useState(null);
  const [welcomeInput, setWelcomeInput] = useState("");
  const [user, setUser] = useState(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const [messages, setMessages] = useState([]);

  const handleNewChat = () => {
    dispatch(selectChat(null));
    setMessages([]);
    setSidebarOpen(false);
  };

  // Ensure user is authenticated and load chats
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/auth/me`, {
        withCredentials: true,
      })
      .then((res) => {
        setUser(res.data.user);

        axios
          .get(`${API_BASE_URL}/api/chat`, {
            withCredentials: true,
          })
          .then((response) => {
            dispatch(setChats(response.data.chats.reverse()));
          });
      })
      .catch((err) => {
        console.error("Auth check failed, redirecting to login:", err);
        navigate("/login");
      });

    const tempSocket = io(API_BASE_URL, {
      withCredentials: true,
    });

    tempSocket.on("ai-response", (messagePayload) => {
      console.log("Received AI response:", messagePayload);

      setMessages((prevMessages) => [
        ...prevMessages,
        {
          type: "ai",
          content: messagePayload.content,
          timestamp: messagePayload.createdAt || new Date().toISOString(),
        },
      ]);

      dispatch(sendingFinished());
    });

    setSocket(tempSocket);

    return () => {
      if (tempSocket) tempSocket.disconnect();
    };
  }, [navigate, dispatch]);

  const handleLogout = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        {},
        {
          withCredentials: true,
        }
      );
      setUser(null);
      dispatch(setChats([]));
      dispatch(selectChat(null));
      setMessages([]);
      if (socket) socket.disconnect();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const sendFirstMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    dispatch(sendingStarted());

    try {
      const title = trimmed.length > 30 ? trimmed.slice(0, 27) + "..." : trimmed;
      const response = await axios.post(
        `${API_BASE_URL}/api/chat`,
        {
          title,
        },
        {
          withCredentials: true,
        },
      );

      const newChat = response.data.chat;
      const newChatId = newChat._id;

      dispatch(startNewChat(newChat));

      setMessages([
        {
          type: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);

      setWelcomeInput("");

      if (socket) {
        socket.emit("ai-message", {
          chat: newChatId,
          content: trimmed,
        });
      }
    } catch (error) {
      console.error("Error creating chat or sending message:", error);
      dispatch(sendingFinished());
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    console.log("Sending message:", trimmed);
    if (!trimmed || !activeChatId || isSending) return;
    dispatch(sendingStarted());

    const newMessages = [
      ...messages,
      {
        type: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      },
    ];

    console.log("New messages:", newMessages);

    setMessages(newMessages);
    dispatch(setInput(""));

    socket.emit("ai-message", {
      chat: activeChatId,
      content: trimmed,
    });

    // try {
    //   const reply = await fakeAIReply(trimmed);
    //   dispatch(addAIMessage(activeChatId, reply));
    // } catch {
    //   dispatch(addAIMessage(activeChatId, 'Error fetching AI response.', true));
    // } finally {
    //   dispatch(sendingFinished());
    // }
  };

  const getMessages = async (chatId) => {
    const response = await axios.get(
      `${API_BASE_URL}/api/chat/messages/${chatId}`,
      { withCredentials: true },
    );

    console.log("Fetched messages:", response.data.messages);

    setMessages(
      response.data.messages.map((m) => ({
        type: m.role === "user" ? "user" : "ai",
        content: m.content,
        timestamp: m.createdAt,
      })),
    );
  };

  return (
    <div className="chat-layout minimal">
      <ChatMobileBar
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onNewChat={handleNewChat}
      />
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          dispatch(selectChat(id));
          setSidebarOpen(false);
          getMessages(id);
        }}
        onNewChat={handleNewChat}
        open={sidebarOpen}
        user={user}
        onLogout={handleLogout}
      />
      <main className="chat-main" role="main">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chip">Early Preview</div>
            <h1>CognitoSphere</h1>
            <p>
              Ask anything. Paste text, brainstorm ideas, or get quick
              explanations. Your chats stay in the sidebar so you can pick up
              where you left off.
            </p>
            {!activeChatId && (
              <div className="welcome-search-container">
                <form
                  className="welcome-search-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendFirstMessage(welcomeInput);
                  }}
                >
                  <input
                    type="text"
                    className="welcome-search-input"
                    placeholder="Message ChatGPT..."
                    value={welcomeInput}
                    onChange={(e) => setWelcomeInput(e.target.value)}
                    disabled={isSending}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="welcome-search-btn"
                    disabled={!welcomeInput.trim() || isSending}
                    aria-label="Send message"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        <ChatMessages messages={messages} isSending={isSending} />
        {activeChatId && (
          <ChatComposer
            input={input}
            setInput={(v) => dispatch(setInput(v))}
            onSend={sendMessage}
            isSending={isSending}
          />
        )}
      </main>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;
