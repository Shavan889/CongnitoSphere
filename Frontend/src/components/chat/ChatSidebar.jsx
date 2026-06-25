import React from 'react';
import './ChatSidebar.css';


const ChatSidebar = ({ chats, activeChatId, onSelectChat, onNewChat, open, user, onLogout }) => {


  
  return (
    <aside className={"chat-sidebar " + (open ? 'open' : '')} aria-label="Previous chats">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="small-btn" onClick={onNewChat}>New</button>
      </div>
      <nav className="chat-list" aria-live="polite">
        {chats.map(c => (
          <button
            key={c._id}
            className={"chat-list-item " + (c._id === activeChatId ? 'active' : '')}
            onClick={() => onSelectChat(c._id)}
          >
            <span className="title-line">{c.title}</span>
          </button>
        ))}
        {chats.length === 0 && <p className="empty-hint">No chats yet.</p>}
      </nav>
      {user && (
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">
              {`${user.fullName?.firstName || ""} ${user.fullName?.lastName || ""}`.trim()}
            </span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
