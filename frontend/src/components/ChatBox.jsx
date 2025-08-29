import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import SearchBox from './SearchBox';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const ChatBox = ({ user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const highlightedMessageRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);
    
    // Join user's room
    socketRef.current.emit('join', user._id);

    // Listen for incoming messages
    socketRef.current.on('messageReceived', (message) => {
      setMessages(prevMessages => {
        // Normalize server sender id (could be string or populated object)
        let serverSenderId = null;
        if (!message) return prevMessages;
        if (typeof message.senderId === 'string' || typeof message.senderId === 'number') {
          serverSenderId = String(message.senderId);
        } else if (message.senderId && (message.senderId._id || message.senderId.id)) {
          serverSenderId = String(message.senderId._id || message.senderId.id);
        }

        // Try to find a matching optimistic message (same sender, same text)
        const matchIndex = prevMessages.findIndex(m => {
          if (!m || !m._meta || !m._meta.sending) return false;
          const optSenderId = String(m.senderId?._id || m.senderId);
          if (!serverSenderId) return false;
          if (optSenderId !== serverSenderId) return false;
          if (!m.message || !message.message) return false;
          if (m.message !== message.message) return false;

          // Optional: if both have timestamps, ensure they are within 2s
          const optTime = m.createdAt ? new Date(m.createdAt).getTime() : null;
          const srvTime = message.createdAt ? new Date(message.createdAt).getTime() : null;
          if (optTime && srvTime) {
            const diff = Math.abs(optTime - srvTime);
            if (diff > 2000) return false;
          }

          return true;
        });

        if (matchIndex !== -1) {
          const copy = [...prevMessages];
          copy[matchIndex] = message;
          return copy;
        }

        // Otherwise avoid duplicates by id
        const exists = prevMessages.some(msg => msg._id === message._id);
        if (!exists) {
          return [...prevMessages, message];
        }
        return prevMessages;
      });
    });

    // Handle socket errors
    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setError('Connection error occurred');
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [user._id]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/users/all`);
        // Filter out current user
        const otherUsers = response.data.users.filter(u => u._id !== user._id);
        setUsers(otherUsers);
        
        // Auto-select first user if available
        if (otherUsers.length > 0 && !selectedUser) {
          setSelectedUser(otherUsers[0]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
      }
    };

    fetchUsers();
  }, [user._id, selectedUser]);

  // Fetch conversation when user is selected
  useEffect(() => {
    if (selectedUser) {
      fetchConversation();
    }
  }, [selectedUser]);

  // Open a message from search (select user and highlight)
  const handleOpenMessage = (result) => {
    try {
      const otherUser = result.senderId._id === user._id ? result.receiverId : result.senderId;
      setSelectedUser(otherUser);

      // If message exists in current list, highlight it; otherwise load conversation then highlight
      setTimeout(() => {
        // Try to find message in messages
        const found = messages.find(m => String(m._id) === String(result._id));
        if (!found) {
          // Re-fetch conversation and then set highlight after load
          fetchConversation().then(() => {
            highlightedMessageRef.current = result._id;
            setTimeout(() => {
              const el = document.getElementById(`msg-${result._id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
          });
        } else {
          highlightedMessageRef.current = result._id;
          setTimeout(() => {
            const el = document.getElementById(`msg-${result._id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }, 200);
    } catch (err) {
      console.error('Failed to open message from search:', err);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversation = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/conversation`, {
        params: {
          userId1: user._id,
          userId2: selectedUser._id,
          limit: 99
        }
      });
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const messageData = {
        senderId: user._id,
        receiverId: selectedUser._id,
        message: newMessage.trim()
      };

      // Optimistic UI: add a temporary message so the user sees it immediately
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        _id: tempId,
        senderId: { _id: user._id, name: user.name },
        receiverId: { _id: selectedUser._id, name: selectedUser.name },
        message: messageData.message,
        createdAt: new Date().toISOString(),
        _meta: { sending: true }
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send via socket for real-time delivery
      socketRef.current.emit('sendMessage', messageData);

      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isMyMessage = (message) => {
    return message.senderId._id === user._id;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.3rem', fontWeight: '600' }}>
              👋 Welcome, {user.name}!
            </h3>
            {selectedUser && (
              <p style={{ opacity: 0.9, fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💬 Chatting with <strong>{selectedUser.name}</strong>
                <span style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10b981',
                  borderRadius: '50%'
                }}></span>
              </p>
            )}
          </div>
          <button 
            onClick={onLogout} 
            className="btn btn-secondary"
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(10px)'
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Users sidebar */}
        <div style={{ 
          width: '280px', 
          borderRight: '1px solid #e0f2fe', 
          padding: '1.5rem',
          overflowY: 'auto',
          background: '#f0f9ff'
        }}>
          <h4 style={{ 
            marginBottom: '1.5rem', 
            color: '#1e3a8a',
            fontSize: '1.1rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            👥 Users 
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '12px',
              fontWeight: '500'
            }}>
              {users.length}
            </span>
          </h4>
          {users.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
              🔍 No other users found
            </p>
          ) : (
            users.map(otherUser => (
              <div
                key={otherUser._id}
                className="user-card"
                onClick={() => setSelectedUser(otherUser)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  marginBottom: '0.75rem',
                  backgroundColor: selectedUser?._id === otherUser._id ? '#dbeafe' : 'white',
                  border: selectedUser?._id === otherUser._id ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {selectedUser?._id === otherUser._id && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#10b981',
                    borderRadius: '50%'
                  }}></div>
                )}
                <div style={{ fontWeight: '600', color: '#1e3a8a', marginBottom: '0.25rem' }}>
                  {otherUser.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {otherUser.email}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedUser ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#64748b'
            }}>
              Select a user to start chatting
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Messages area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ 
                  flex: 1, 
                  padding: '1.5rem', 
                  overflowY: 'auto',
                  background: '#fafbff'
                }}>
                  {error && (
                    <div className="error" style={{ margin: '0 0 1rem 0' }}>
                      {error}
                    </div>
                  )}
                  
                  {loading ? (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#64748b',
                      marginTop: '2rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #e0f2fe',
                        borderTop: '4px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Loading conversation...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#64748b',
                      marginTop: '2rem',
                      padding: '2rem',
                      background: 'white',
                      borderRadius: '16px',
                      border: '2px dashed #bfdbfe'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                      <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                        No messages yet
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>
                        Start the conversation with {selectedUser?.name}!
                      </div>
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isHighlighted = highlightedMessageRef.current && String(highlightedMessageRef.current) === String(message._id);
                      const isMe = isMyMessage(message);
                      return (
                        <div
                          id={`msg-${message._id}`}
                          key={message._id || index}
                          className="message-enter"
                          style={{
                            display: 'flex',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            marginBottom: '1rem',
                            animation: isHighlighted ? 'messageSlideIn 0.5s ease' : 'none'
                          }}
                        >
                          <div
                            style={{
                              maxWidth: '75%',
                              padding: '1rem 1.25rem',
                              borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                              background: isHighlighted 
                                ? '#fef3cd' 
                                : isMe 
                                  ? '#3b82f6' 
                                  : 'white',
                              color: isMe ? 'white' : '#1e3a8a',
                              boxShadow: isHighlighted 
                                ? '0 8px 25px rgba(245, 158, 11, 0.25)' 
                                : '0 2px 8px rgba(59, 130, 246, 0.1)',
                              border: isHighlighted ? '2px solid #f59e0b' : isMe ? 'none' : '1px solid #e0f2fe',
                              position: 'relative'
                            }}
                          >
                            {isHighlighted && (
                              <div style={{
                                position: 'absolute',
                                top: '-0.5rem',
                                left: '1rem',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: '600'
                              }}>
                                📍 From Search
                              </div>
                            )}
                            <div style={{ marginBottom: '0.5rem', fontSize: '1rem', lineHeight: '1.5' }}>
                              {message.message}
                            </div>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              opacity: 0.8,
                              textAlign: 'right',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{ fontSize: '0.7rem' }}>
                                {isMe ? '👤 You' : `👤 ${message.senderId?.name || 'Unknown'}`}
                              </span>
                              <span>{formatTime(message.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Enhanced message input */}
                <form 
                  onSubmit={handleSendMessage}
                  style={{ 
                    padding: '1.5rem', 
                    borderTop: '1px solid #e0f2fe',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'flex-end',
                    background: 'white'
                  }}
                >
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message ${selectedUser?.name || 'user'}...`}
                    style={{ 
                      flex: 1,
                      padding: '1rem 1.25rem',
                      border: '2px solid #bfdbfe',
                      borderRadius: '25px',
                      outline: 'none',
                      fontSize: '1rem',
                      transition: 'all 0.2s ease',
                      background: '#f0f9ff'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      e.target.style.background = 'white';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#bfdbfe';
                      e.target.style.boxShadow = 'none';
                      e.target.style.background = '#f0f9ff';
                    }}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!newMessage.trim()}
                    style={{ 
                      borderRadius: '25px', 
                      minWidth: '100px',
                      height: '52px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>Send</span>
                    <span style={{ fontSize: '1.2rem' }}>🚀</span>
                  </button>
                </form>
              </div>

              {/* Search sidebar */}
              <SearchBox user={user} onOpenMessage={handleOpenMessage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
