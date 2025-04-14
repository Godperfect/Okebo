const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const port = 3000;

// Load credentials from password.json
const credentials = JSON.parse(fs.readFileSync('./password.json', 'utf8'));

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(express.json());
app.use(express.static(__dirname, {
  index: false // Prevent automatically serving index.html
}));

// Session secret management
const sessionSecretFile = './session-secret.json';
let sessionSecret;

// Try to load existing secret from file or generate a new one
try {
  if (fs.existsSync(sessionSecretFile)) {
    const secretData = JSON.parse(fs.readFileSync(sessionSecretFile, 'utf8'));
    sessionSecret = secretData.secret;
    console.log('Using existing session secret');
  } else {
    // Generate a new strong secret
    sessionSecret = crypto.randomBytes(64).toString('hex');

    // Save the secret to file
    fs.writeFileSync(sessionSecretFile, JSON.stringify({ 
      secret: sessionSecret,
      generated: new Date().toISOString()
    }));
    console.log('Generated new session secret');
  }
} catch (err) {
  console.error('Error managing session secret:', err);
  // Fall back to a random secret for this session only
  sessionSecret = crypto.randomBytes(64).toString('hex');
  console.warn('Using temporary session secret - all sessions will be invalidated on restart');
}

// Configure session middleware with our secret
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 3600000 // Session expires after 1 hour
  }
}));

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Root route redirects to login
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/admin');
  } else {
    res.redirect('/login');
  }
});

// Login page route
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/admin');
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

// Login authentication route
app.post('/auth', (req, res) => {
  const { username, password } = req.body;

  if (credentials.Username === username && credentials.Password === password) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Admin dashboard route (protected)
app.get('/admin', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// All API routes are protected by authentication middleware
// Get all Firebase Auth users
app.get('/users', ensureAuthenticated, async (req, res) => {
  try {
    let users = [];
    let nextPageToken;
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      users = users.concat(result.users.map(user => ({
        uid: user.uid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        creationTime: user.metadata.creationTime,
        disabled: user.disabled,
      })));
      nextPageToken = result.pageToken;
    } while (nextPageToken);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
app.post('/create-user', ensureAuthenticated, async (req, res) => {
  const { email, phoneNumber, displayName, password } = req.body;
  try {
    const userRecord = await admin.auth().createUser({
      email,
      phoneNumber: phoneNumber || undefined,
      displayName,
      password,
    });
    res.json({ success: true, user: userRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle user disabled/enabled
app.post('/user-status', ensureAuthenticated, async (req, res) => {
  const { uid, disabled } = req.body;
  try {
    const updatedUser = await admin.auth().updateUser(uid, { disabled });
    res.json({ success: true, updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send password reset email
app.post('/reset-password', ensureAuthenticated, async (req, res) => {
  const { email } = req.body;
  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ resetLink: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
app.post('/delete-user', ensureAuthenticated, async (req, res) => {
  const { uid } = req.body;
  try {
    await admin.auth().deleteUser(uid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Admin panel is live at http://localhost:${port}`);
});