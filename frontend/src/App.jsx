import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ChatBox from './components/ChatBox';

function App() {
  const [user, setUser] = useState(null);

  // Check for saved user in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('chatAppUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('chatAppUser');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('chatAppUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('chatAppUser');
  };

  return (
    <div className="app">
      {user ? (
        <ChatBox user={user} onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
