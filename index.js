const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Load credentials
const credentials = JSON.parse(fs.readFileSync('./password.json', 'utf8'));
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname, { index: false }));

// Create devtools detection script
const devtoolsDetectionScript = `
<script>
  // Function to detect DevTools
  (function detectDevTools() {
    function redirectToDeadPage() {
      window.location.href = '/dead.html';
    }

    // Method 1: Check window dimensions
    function checkDimensions() {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || 
          window.outerHeight - window.innerHeight > threshold) {
        redirectToDeadPage();
      }
    }

    // Method 2: Debug trick to detect console
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        redirectToDeadPage();
      }
    });

    // Method 3: Debugger detection
    function isDebuggerEnabled() {
      const startTime = new Date();
      debugger;
      const endTime = new Date();
      return endTime - startTime > 100;
    }

    // Set up continuous monitoring
    window.addEventListener('resize', checkDimensions);
    setInterval(checkDimensions, 1000);

    // Check developer tools status on page load
    checkDimensions();

    // Periodically check for console tricks
    setInterval(function() {
      console.log('%c', element);
      console.clear();
      if (isDebuggerEnabled()) {
        redirectToDeadPage();
      }
    }, 1000);
  })();
</script>`;

// Middleware to inject devtools detection script
const injectDevtoolsDetection = (req, res, next) => {
  const originalSend = res.send;
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('</head>')) {
      body = body.replace('</head>', `${devtoolsDetectionScript}</head>`);
    }
    originalSend.call(this, body);
  };
  next();
};

app.use(injectDevtoolsDetection);

// Session configuration (in-memory)
const sessionSecret = crypto.randomBytes(64).toString('hex');

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Render uses HTTP during development preview
    maxAge: 3600000
  }
}));

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
};

// Routes
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/admin');
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/admin');
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

app.post('/auth', (req, res) => {
  const { username, password } = req.body;
  if (credentials.Username === username && credentials.Password === password) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/admin', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// DevTools redirect page
app.get('/dead.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dead.html'));
});

// API routes (require authentication)
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

app.post('/user-status', ensureAuthenticated, async (req, res) => {
  const { uid, disabled } = req.body;
  try {
    const updatedUser = await admin.auth().updateUser(uid, { disabled });
    res.json({ success: true, updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/reset-password', ensureAuthenticated, async (req, res) => {
  const { email } = req.body;
  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    res.json({ resetLink: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/delete-user', ensureAuthenticated, async (req, res) => {
  const { uid } = req.body;
  try {
    await admin.auth().deleteUser(uid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Admin panel running at http://localhost:${port}`);
});