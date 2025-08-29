import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const LoginForm = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { name, email } = formData;
      
      if (!name.trim() || !email.trim()) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/users`, {
        name: name.trim(),
        email: email.trim().toLowerCase()
      });

      if (response.data.user) {
        onLogin(response.data.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.error || 'Failed to login/signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2 style={{ 
        marginBottom: '1rem', 
        textAlign: 'center', 
        color: '#1e293b',
        fontSize: '1.8rem',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}>
        🚀 Chat App
      </h2>
      
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderRadius: '12px',
        border: '1px solid #c7d2fe'
      }}>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#3730a3', marginBottom: '0.5rem' }}>
          🧠 AI-Powered Semantic Search
        </div>
        <div style={{ fontSize: '0.85rem', color: '#4338ca' }}>
          Search messages by meaning, not just keywords
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your name"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Loading...' : 'Login / Sign Up'}
        </button>
      </form>
      
      <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
        Enter your name and email to login or create a new account
      </p>
    </div>
  );
};

export default LoginForm;
