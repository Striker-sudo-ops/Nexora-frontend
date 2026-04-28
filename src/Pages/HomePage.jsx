import { useState, useEffect } from 'react';
import Login from '../components/Authentication/Login';
import Signup from '../components/Authentication/Signup';

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('login');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('userInfo'));
    const urlParams = new URLSearchParams(window.location.search);
    if (user && urlParams.get('action') !== 'add_account') {
      window.location.href = '/chat';
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '450px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Title */}
        <div style={{
          padding: '30px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'fit-content' }}>
            <img 
              src="/nexora-logo-transparent.png" 
              alt="Nexora Logo" 
              style={{ 
                display: 'block',
                margin: '0 0 10px 0',
                width: '97px', 
                height: '97px', 
                objectFit: 'contain',
                boxShadow: 'none'
              }} 
            />
            <h1 style={{
              margin: '0',
              padding: '0',
              fontSize: '2.2rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center'
            }}>Nexora</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px', margin: '5px 0 0 0', textAlign: 'center' }}>
              Instant. Smart. Connected.
            </p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <button
            onClick={() => setActiveTab('login')}
            style={{
              flex: 1,
              padding: '15px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'login' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'login' ? 'white' : 'var(--text-secondary)',
              fontWeight: activeTab === 'login' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            style={{
              flex: 1,
              padding: '15px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'signup' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'signup' ? 'white' : 'var(--text-secondary)',
              fontWeight: activeTab === 'signup' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '10px' }}>
          {activeTab === 'login' ? <Login /> : <Signup />}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
