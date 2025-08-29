import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const SearchBox = ({ user, onOpenMessage }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError('');
    
    try {
      // Use the new combined search endpoint
      const response = await axios.get(`${API_BASE_URL}/messages/search`, {
        params: {
          userId: user._id,
          q: searchQuery.trim(),
          limit: 10,
          wordWeight: 0.4,
          semanticWeight: 0.6,
          combineResults: true
        }
      });

      setSearchResults(response.data.results || []);
      
      // Log search metadata for debugging
      console.log('Search metadata:', response.data.metadata);
    } catch (error) {
      console.error('Search error:', error);
      setError(error.response?.data?.error || 'Failed to search messages');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{
      width: '360px',
      borderLeft: '1px solid #e0f2fe',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8faff',
      overflow: 'hidden'
    }}>
      {/* Search Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid #e0f2fe',
        background: 'white'
      }}>
        <h3 style={{
          margin: '0 0 1rem 0',
          color: '#1e3a8a',
          fontSize: '1.1rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🔍 Smart Search
        </h3>
        
        <div style={{
          fontSize: '0.8rem',
          color: '#64748b',
          marginBottom: '1rem',
          lineHeight: '1.4'
        }}>
          Combines word search + AI semantic search for better results
        </div>
        
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages..."
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              border: '2px solid #bfdbfe',
              borderRadius: '12px',
              outline: 'none',
              fontSize: '0.95rem',
              transition: 'all 0.2s ease',
              background: '#f0f9ff',
              boxSizing: 'border-box'
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
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: searchQuery.trim() ? '#3b82f6' : '#94a3b8',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            onMouseEnter={(e) => {
              if (searchQuery.trim()) {
                e.target.style.background = '#2563eb';
                e.target.style.transform = 'translateY(-50%) scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              if (searchQuery.trim()) {
                e.target.style.background = '#3b82f6';
                e.target.style.transform = 'translateY(-50%) scale(1)';
              }
            }}
          >
            {isSearching ? (
              <>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>...</span>
              </>
            ) : (
              <>
                <span>🔍</span>
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search Results */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: error || searchResults.length === 0 ? '1.5rem' : '0'
      }}>
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {!error && searchResults.length === 0 && searchQuery && !isSearching && (
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            padding: '2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2.5rem' }}>🔍</div>
            <div style={{ fontSize: '1rem', fontWeight: '500' }}>No results found</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Try searching with different keywords
            </div>
          </div>
        )}

        {!error && searchResults.length === 0 && !searchQuery && (
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            padding: '2rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2.5rem' }}>💬</div>
            <div style={{ fontSize: '1rem', fontWeight: '500' }}>Search your messages</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, textAlign: 'center', lineHeight: '1.4' }}>
              Smart search combines exact word matching with<br />
              AI-powered semantic understanding for better results
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div>
            <div style={{
              padding: '1rem 1.5rem 0.5rem',
              fontSize: '0.85rem',
              color: '#64748b',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>📊</span>
              <span>Top {searchResults.length} results</span>
              {searchResults.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                  ({searchResults[0].sources?.join(' + ') || 'combined'})
                </span>
              )}
            </div>
            
            {searchResults.map((result, index) => (
              <div
                key={result._id || index}
                onClick={() => onOpenMessage(result)}
                style={{
                  margin: '0.5rem 1rem',
                  padding: '1rem',
                  background: 'white',
                  border: '1px solid #e0f2fe',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e0f2fe';
                  e.target.style.boxShadow = '0 1px 3px rgba(59, 130, 246, 0.1)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                {/* Ranking badge */}
                <div style={{
                  position: 'absolute',
                  top: '-0.5rem',
                  left: '1rem',
                  background: '#3b82f6',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '8px',
                  fontSize: '0.7rem',
                  fontWeight: '600'
                }}>
                  #{index + 1}
                </div>

                {/* Message content */}
                <div style={{
                  marginBottom: '0.75rem',
                  color: '#1e3a8a',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  marginTop: '0.5rem'
                }}>
                  {result.message}
                </div>

                {/* Message metadata */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: '#64748b'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>👤</span>
                    <span>{result.senderId?.name || 'Unknown'}</span>
                  </span>
                  <span>{formatTime(result.createdAt)}</span>
                </div>

                {/* Similarity score and sources */}
                <div style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    background: '#dbeafe',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <span>🎯</span>
                    <span>{Math.round((result.finalScore || result.similarity || result.score || 0) * 100)}% match</span>
                  </div>
                  
                  {result.sources && result.sources.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem',
                      flexWrap: 'wrap'
                    }}>
                      {result.sources.map((source, idx) => (
                        <span key={idx} style={{
                          padding: '0.2rem 0.4rem',
                          background: source === 'word' ? '#dcfce7' : '#f3e8ff',
                          color: source === 'word' ? '#166534' : '#7c3aed',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: '500'
                        }}>
                          {source === 'word' ? '📝' : '🧠'} {source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBox;
