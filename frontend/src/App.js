import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios defaults
axios.defaults.baseURL = API_URL;

// Add token to requests
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  // Timer states
  const [timer, setTimer] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [timerInputs, setTimerInputs] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [timerResult, setTimerResult] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Poll timer status
  useEffect(() => {
    if (!user) return;

    const fetchTimer = async () => {
      try {
        const response = await axios.get('/timer/current');
        if (response.data.timer) {
          setTimer(response.data.timer);
          setRemainingTime(response.data.timer.remainingSeconds);

          if (response.data.timer.status === 'completed') {
            handleTimerComplete();
          }
        } else {
          setTimer(null);
          setRemainingTime(0);
        }
      } catch (error) {
        console.error('Failed to fetch timer:', error);
      }
    };

    fetchTimer();
    const interval = setInterval(fetchTimer, 1000);

    return () => clearInterval(interval);
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await axios.get('/auth/verify');
        setUser(response.data.user);
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage('');

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login'
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(endpoint, payload);

      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      setMessage('');
      setFormData({ username: '', email: '', password: '' });
    } catch (error) {
      if (error.response?.data?.errors) {
        const errorMap = {};
        error.response.data.errors.forEach(err => {
          errorMap[err.path] = err.msg;
        });
        setErrors(errorMap);
      } else if (error.response?.data?.error) {
        setMessage(error.response.data.error);
      } else {
        setMessage('An error occurred. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTimer(null);
    setTimerResult(null);
    setMessage('');
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = async () => {
    try {
      setMessage('');
      setTimerResult(null);

      const response = await axios.post('/timer/start', {
        hours: parseInt(timerInputs.hours) || 0,
        minutes: parseInt(timerInputs.minutes) || 0,
        seconds: parseInt(timerInputs.seconds) || 0
      });

      setTimer(response.data.timer);
      setTimerInputs({ hours: 0, minutes: 0, seconds: 0 });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to start timer');
    }
  };

  const pauseTimer = async () => {
    try {
      const response = await axios.post('/timer/pause');
      setTimer(response.data.timer);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to pause timer');
    }
  };

  const resumeTimer = async () => {
    try {
      const response = await axios.post('/timer/resume');
      setTimer(response.data.timer);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to resume timer');
    }
  };

  const stopTimer = async () => {
    try {
      const response = await axios.post('/timer/stop');

      const totalSeconds = Math.floor((new Date(response.data.timer.startTime) - new Date()) / 1000 * -1);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimerResult({
        time: `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        earnedCoins: response.data.earnedCoins,
        totalCoins: response.data.totalCoins,
        level: user.accountLevel,
        multiplier: user.multiplier
      });

      setTimer(null);
      setUser(prev => ({ ...prev, coins: response.data.totalCoins }));
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to stop timer');
    }
  };

  const handleTimerComplete = async () => {
    try {
      const response = await axios.get('/user/profile');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div className="loading"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <div className="auth-container">
          <h1 className="auth-title">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>

          {message && (
            <div className="message error-message">{message}</div>
          )}

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
                {errors.username && <span className="error-message">{errors.username}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === 'login' ? (
              <>
                Don't have an account?{' '}
                <span className="auth-switch-link" onClick={() => setAuthMode('register')}>
                  Register
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span className="auth-switch-link" onClick={() => setAuthMode('login')}>
                  Login
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">Learning Timer</h1>

          <div className="user-info">
            <div className="user-stat">
              <span className="user-stat-label">Username</span>
              <span className="user-stat-value">{user.username}</span>
            </div>

            <div className="user-stat">
              <span className="user-stat-label">Level</span>
              <span className="user-stat-value">{user.accountLevel}</span>
            </div>

            <div className="user-stat">
              <span className="user-stat-label">Coins</span>
              <span className="user-stat-value coins-display">
                {parseFloat(user.coins).toFixed(2)}
              </span>
            </div>

            <button className="btn btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="timer-container">
        {message && (
          <div className="message error-message">{message}</div>
        )}

        {!timer ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
              Start Your Learning Session
            </h2>

            <div className="timer-inputs">
              <div className="timer-input-group">
                <label className="timer-input-label">Hours</label>
                <input
                  type="number"
                  className="timer-input"
                  min="0"
                  max="2"
                  value={timerInputs.hours}
                  onChange={(e) => setTimerInputs({ ...timerInputs, hours: e.target.value })}
                />
              </div>

              <div className="timer-input-group">
                <label className="timer-input-label">Minutes</label>
                <input
                  type="number"
                  className="timer-input"
                  min="0"
                  max="59"
                  value={timerInputs.minutes}
                  onChange={(e) => setTimerInputs({ ...timerInputs, minutes: e.target.value })}
                />
              </div>

              <div className="timer-input-group">
                <label className="timer-input-label">Seconds</label>
                <input
                  type="number"
                  className="timer-input"
                  min="0"
                  max="59"
                  value={timerInputs.seconds}
                  onChange={(e) => setTimerInputs({ ...timerInputs, seconds: e.target.value })}
                />
              </div>
            </div>

            <div className="timer-controls">
              <button className="btn btn-primary" onClick={startTimer}>
                Start Timer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="timer-display">
              <div className="timer-time">{formatTime(remainingTime)}</div>
              <div className="timer-status">
                Status: {timer.status === 'paused' ? 'Paused' : 'Running'}
              </div>
            </div>

            <div className="timer-controls">
              {timer.status === 'active' ? (
                <button className="btn btn-secondary" onClick={pauseTimer}>
                  Pause
                </button>
              ) : (
                <button className="btn btn-primary" onClick={resumeTimer}>
                  Resume
                </button>
              )}

              <button className="btn btn-danger" onClick={stopTimer}>
                Stop & Complete
              </button>
            </div>
          </>
        )}

        {timerResult && (
          <div className="result-display">
            <h3 className="result-title">Session Complete!</h3>
            <div className="result-details">
              <p>{timerResult.time}h of learning = {Math.floor(parseFloat(timerResult.earnedCoins) / timerResult.multiplier)} Coins</p>
              <p>Account-level {timerResult.level} = Multiplier {timerResult.multiplier}</p>
              <p>{Math.floor(parseFloat(timerResult.earnedCoins) / timerResult.multiplier)} x {timerResult.multiplier} = {timerResult.earnedCoins}</p>
            </div>
            <div className="result-coins">
              Total Coins: {parseFloat(timerResult.totalCoins).toFixed(2)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;