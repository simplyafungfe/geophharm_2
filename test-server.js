const express = require('express');
const path = require('path');

const app = express();
const PORT = 3002;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route for home page
app.get('/home.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Route for registration page
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Route for login page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route for client dashboard
app.get('/client-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client-dashboard.html'));
});

// Route for pharmacist dashboard
app.get('/pharmacist-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pharmacist-dashboard.html'));
});

// Route for admin dashboard
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Geopharm test server running on port ${PORT}`);
  console.log(`🎨 Web Interface: http://localhost:${PORT}`);
  console.log('✅ All HTML files should now connect properly!');
});

module.exports = app;
