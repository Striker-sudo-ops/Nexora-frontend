import { useState } from 'react';
import axios from 'axios';

const Login = () => {
  const [view, setView] = useState('login'); // login, forgot-password, reset-password
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot/Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!email || !password) {
      setError('Please fill all the fields');
      setLoading(false);
      return;
    }

    try {
      const config = {
        headers: {
          'Content-type': 'application/json',
        },
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/login`,
        { email, password },
        config
      );

      localStorage.setItem('userInfo', JSON.stringify(data));
      
      let accounts = JSON.parse(localStorage.getItem('userAccounts')) || [];
      accounts = accounts.filter(acc => acc.email !== data.email);
      accounts.push(data);
      localStorage.setItem('userAccounts', JSON.stringify(accounts));
      setLoading(false);
      // Redirect to chat page
      window.location.href = '/chat';
    } catch (error) {
      setError(error.response?.data?.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/forgot-password`, { email: resetEmail });
      setSuccessMsg(data.message);
      setView('reset-password');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetOtp || !newPassword) {
      setError('Please fill all fields');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/reset-password`, { 
        email: resetEmail, 
        otp: resetOtp, 
        newPassword 
      });
      setSuccessMsg(data.message);
      setView('login');
      // Reset state
      setResetEmail('');
      setResetOtp('');
      setNewPassword('');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {error && <span className="error-message">{error}</span>}
      {successMsg && <span className="success-message" style={{ color: '#10b981', display: 'block', marginBottom: '10px' }}>{successMsg}</span>}
      
      {view === 'login' && (
        <form onSubmit={submitHandler}>
          <div style={{ marginBottom: '15px' }}>
            <label className="input-label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <span 
              style={{ color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => { setView('forgot-password'); setError(''); setSuccessMsg(''); }}
            >
              Forgot Password?
            </span>
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      )}

      {view === 'forgot-password' && (
        <form onSubmit={handleForgotPassword}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>
            Enter your email address and we'll send you an OTP to reset your password.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, marginBottom: '15px' }}
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <span 
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
            >
              Back to Login
            </span>
          </div>
        </form>
      )}

      {view === 'reset-password' && (
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: '15px' }}>
            <label className="input-label">OTP</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter 6-digit OTP"
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">New Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, marginBottom: '15px' }}
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <span 
              style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
            >
              Back to Login
            </span>
          </div>
        </form>
      )}
    </div>
  );
};

export default Login;
