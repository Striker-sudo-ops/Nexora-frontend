import { useState } from 'react';
import axios from 'axios';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmpassword, setConfirmpassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!name || !email || !mobile || !password || !confirmpassword) {
      setError('Please fill all the fields');
      setLoading(false);
      return;
    }

    if (password !== confirmpassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const config = {
        headers: {
          'Content-type': 'application/json',
        },
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/register`,
        { name, email, mobile, password },
        config
      );

      setSuccess('Registration successful! Please check your email for the OTP.');
      setOtpSent(true);
      setLoading(false);
    } catch (error) {
      setError(error.response?.data?.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const verifyOtpHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const config = {
        headers: {
          'Content-type': 'application/json',
        },
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/verify`,
        { email, otp },
        config
      );

      localStorage.setItem('userInfo', JSON.stringify(data));
      
      let accounts = JSON.parse(localStorage.getItem('userAccounts')) || [];
      accounts = accounts.filter(acc => acc.email !== data.email);
      accounts.push(data);
      localStorage.setItem('userAccounts', JSON.stringify(accounts));
      setLoading(false);
      window.location.href = '/chat';
    } catch (error) {
      setError(error.response?.data?.message || 'Invalid OTP');
      setLoading(false);
    }
  };

  if (otpSent) {
    return (
      <div style={{ padding: '20px' }}>
        <h3 style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>Verify Your Account</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          We've sent a 6-digit OTP to your email address. Please enter it below.
        </p>
        {error && <span className="error-message">{error}</span>}
        {success && <span className="success-message">{success}</span>}
        <form onSubmit={verifyOtpHandler}>
          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">Enter OTP</label>
            <input
              type="text"
              className="input-field"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify & Login'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {error && <span className="error-message">{error}</span>}
      <form onSubmit={submitHandler}>
        <div style={{ marginBottom: '15px' }}>
          <label className="input-label">Full Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
        <div style={{ marginBottom: '15px' }}>
          <label className="input-label">Mobile Number</label>
          <input
            type="tel"
            className="input-field"
            placeholder="Enter your mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label className="input-label">Password</label>
          <input
            type="password"
            className="input-field"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label className="input-label">Confirm Password</label>
          <input
            type="password"
            className="input-field"
            placeholder="Confirm your password"
            value={confirmpassword}
            onChange={(e) => setConfirmpassword(e.target.value)}
          />
        </div>
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
};

export default Signup;
