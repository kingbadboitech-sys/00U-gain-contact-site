const express = require('express');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Backend server URLs
const BACKEND_SERVERS = [
  'http://165.22.246.25:1900',
  'http://165.22.246.25:1901',
  'http://165.22.246.25:1902',
  'http://165.22.246.25:1903',
  'http://165.22.246.25:1904',
  'http://165.22.246.25:1907',
  'http://165.22.246.25:1909',
  'http://165.22.246.25:1910',
  'http://165.22.246.25:1911'
];

// Premium server URLs
const PREMIUM_SERVERS = [
  'http://165.22.246.25:1908'
];

// Store for tracking server health and sessions
const serverHealth = BACKEND_SERVERS.reduce((acc, _, i) => {
  acc[i] = { 
    healthy: true, 
    sessions: 0,
    maxSessions: 30
  };
  return acc;
}, {});

// Premium server health tracking
const premiumServerHealth = PREMIUM_SERVERS.reduce((acc, _, i) => {
  acc[i] = { 
    healthy: true, 
    sessions: 0,
    maxSessions: 30
  };
  return acc;
}, {});

// User authentication storage
let users = {
  'kingbadboi': {
    password: '08140825959',
    isAdmin: true
  }
};

// Premium keys storage (in-memory for server)
let premiumKeys = new Set();

// Comments storage
let comments = [];

// Track active visitors (not just page refreshes)
const activeVisitors = new Map();
const VISITOR_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Clean up inactive visitors periodically
setInterval(() => {
  const now = Date.now();
  for (const [visitorId, lastActive] of activeVisitors.entries()) {
    if (now - lastActive > VISITOR_TIMEOUT) {
      activeVisitors.delete(visitorId);
    }
  }
  console.log(`Active visitors: ${activeVisitors.size}`);
}, 60000); // Check every minute

// Failed login attempts tracking (for cooldown)
const failedAttempts = new Map();

// Round-robin counters
let currentServerIndex = 0;
let currentPremiumServerIndex = 0;

// Data file paths
const DATA_DIR = 'data';
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const SERVER_HEALTH_FILE = path.join(DATA_DIR, 'server_health.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Load data from files
async function loadData() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Load premium keys
    try {
      const keysData = await fs.readFile(KEYS_FILE, 'utf8');
      const keysArray = JSON.parse(keysData);
      premiumKeys = new Set(keysArray);
      console.log(`Loaded ${premiumKeys.size} premium keys from storage`);
    } catch (error) {
      console.log('No keys file found, starting with empty keys set');
      await fs.writeFile(KEYS_FILE, JSON.stringify([]));
    }
    
    // Load users
    try {
      const usersData = await fs.readFile(USERS_FILE, 'utf8');
      const loadedUsers = JSON.parse(usersData);
      users = { ...users, ...loadedUsers }; // Merge with default admin user
      console.log(`Loaded ${Object.keys(users).length} users from storage`);
    } catch (error) {
      console.log('No users file found, using default admin user');
      await saveUsers();
    }
    
    // Load comments
    try {
      const commentsData = await fs.readFile(COMMENTS_FILE, 'utf8');
      comments = JSON.parse(commentsData);
      console.log(`Loaded ${comments.length} comments from storage`);
    } catch (error) {
      console.log('No comments file found, starting with empty comments');
      await saveComments();
    }
    
    // Load server health state
    try {
      const healthData = await fs.readFile(SERVER_HEALTH_FILE, 'utf8');
      const savedHealth = JSON.parse(healthData);
      
      // Restore server health states
      if (savedHealth.regular) {
        Object.keys(savedHealth.regular).forEach(index => {
          if (serverHealth[index]) {
            serverHealth[index].healthy = savedHealth.regular[index].healthy;
            serverHealth[index].sessions = savedHealth.regular[index].sessions || 0;
          }
        });
      }
      if (savedHealth.premium) {
        Object.keys(savedHealth.premium).forEach(index => {
          if (premiumServerHealth[index]) {
            premiumServerHealth[index].healthy = savedHealth.premium[index].healthy;
            premiumServerHealth[index].sessions = savedHealth.premium[index].sessions || 0;
          }
        });
      }
      
      console.log('Loaded server health states from storage');
    } catch (error) {
      console.log('No server health file found, using defaults');
      await saveServerHealth();
    }
    
    // Load configuration
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      
      if (config.roundRobinCounters) {
        currentServerIndex = config.roundRobinCounters.regular || 0;
        currentPremiumServerIndex = config.roundRobinCounters.premium || 0;
      }
      
      console.log('Loaded configuration from storage');
    } catch (error) {
      console.log('No config file found, using defaults');
      await saveConfig();
    }
    
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Save data to files
async function saveData() {
  try {
    await Promise.all([
      savePremiumKeys(),
      saveUsers(),
      saveComments(),
      saveServerHealth(),
      saveConfig()
    ]);
    console.log('All data saved successfully');
    } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Individual save functions
async function savePremiumKeys() {
  try {
    await fs.writeFile(KEYS_FILE, JSON.stringify(Array.from(premiumKeys), null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving premium keys:', error);
  }
}

async function saveUsers() {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

async function saveComments() {
  try {
    await fs.writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving comments:', error);
  }
}

async function saveServerHealth() {
  try {
    const healthData = {
      regular: serverHealth,
      premium: premiumServerHealth,
      timestamp: new Date().toISOString()
    };
    await fs.writeFile(SERVER_HEALTH_FILE, JSON.stringify(healthData, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving server health:', error);
  }
}

async function saveConfig() {
  try {
    const config = {
      roundRobinCounters: {
        regular: currentServerIndex,
        premium: currentPremiumServerIndex
      },
      timestamp: new Date().toISOString()
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

// Helper functions
function validatePhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    return { valid: false, error: 'Phone numbers starting with 0 are not allowed' };
  }
  
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'Phone numbers can only contain digits' };
  }
  
  if (cleaned.length < 10) {
    return { valid: false, error: 'Phone number must be at least 10 digits' };
  }
  
  if (cleaned.length > 15) {
    return { valid: false, error: 'Phone number cannot exceed 15 digits' };
  }
  
  return { valid: true, number: cleaned };
}

function validatePremiumKey(key) {
  // Check if key is in our stored keys
  if (premiumKeys.has(key)) {
    return true;
  }
  
  // If not in stored keys, check if it matches the format
  // Key must start with 4 or 9 and end with 4qr or 9we, with exactly 6 digits in between
  const regex = /^(4|9)\d{6}(4qr|9we)$/;
  const isValidFormat = regex.test(key);
  
  console.log(`ð Key validation: ${key}, is valid format: ${isValidFormat}`);
  
  return isValidFormat;
}

function generatePremiumKey() {
  const prefixes = ['4', '9'];
  const suffixes = ['4qr', '9we'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  // Generate middle part (6 random digits)
  let middle = '';
  for (let i = 0; i < 6; i++) {
    middle += Math.floor(Math.random() * 10);
  }
  
  const key = prefix + middle + suffix;
  premiumKeys.add(key);
  savePremiumKeys(); // Save to permanent storage
  return key;
}

// Helper function to check if pairing code is in 8-digit format
function isEightDigitCode(code) {
  return /^\d{8}$/.test(code);
}

// Helper function to process pairing code response and add copy support
function processPairingCodeResponse(responseData) {
  if (responseData.success && responseData.pairingCode) {
    const code = responseData.pairingCode.toString();
    const isEightDigit = isEightDigitCode(code);
    
    return {
      ...responseData,
      canCopy: isEightDigit,
      codeFormat: isEightDigit ? '8-digit' : 'other',
      copyEnabled: isEightDigit,
      formattedCode: isEightDigit ? code.match(/.{1,4}/g).join('-') : code,
      rawCode: code
    };
  }
  
  return responseData;
}

function getNextAvailableServer() {
  const totalServers = BACKEND_SERVERS.length;
  let attempts = 0;
  
  while (attempts < totalServers) {
    const index = currentServerIndex;
    currentServerIndex = (currentServerIndex + 1) % totalServers;
    
    if (serverHealth[index].healthy && serverHealth[index].sessions < serverHealth[index].maxSessions) {
      // Save updated counter
      saveConfig();
      return { url: BACKEND_SERVERS[index], index: index, isPremium: false };
    }
    
    attempts++;
  }
  
  return null;
}

function getNextAvailablePremiumServer() {
  const totalServers = PREMIUM_SERVERS.length;
  let attempts = 0;
  
  while (attempts < totalServers) {
    const index = currentPremiumServerIndex;
    currentPremiumServerIndex = (currentPremiumServerIndex + 1) % totalServers;
    
    if (premiumServerHealth[index].healthy && premiumServerHealth[index].sessions < premiumServerHealth[index].maxSessions) {
      // Save updated counter
      saveConfig();
      return { url: PREMIUM_SERVERS[index], index: index, isPremium: true };
    }
    
    attempts++;
  }
  
  return null;
}

async function checkServerHealth(serverUrl, index, isPremium = false) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${serverUrl}/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      const sessionCount = data.success && data.sessions ? data.sessions.length : 0;
      
      if (isPremium) {
        premiumServerHealth[index] = {
          healthy: true,
          sessions: sessionCount,
          maxSessions: 30
        };
      } else {
        serverHealth[index] = {
          healthy: true,
          sessions: sessionCount,
          maxSessions: 30
        };
      }
      
      console.log(`â Server ${index + 1} (${serverUrl}) is healthy with ${sessionCount} sessions`);
      
      // Save health state
      await saveServerHealth();
      return true;
    } else {
      if (isPremium) {
        premiumServerHealth[index].healthy = false;
      } else {
        serverHealth[index].healthy = false;
      }
      console.log(`â Server ${index + 1} (${serverUrl}) responded with status: ${response.status}`);
      
      // Save health state
      await saveServerHealth();
      return false;
    }
  } catch (error) {
    if (isPremium) {
      premiumServerHealth[index].healthy = false;
    } else {
      serverHealth[index].healthy = false;
    }
    console.log(`â Server ${index + 1} (${serverUrl}) health check failed:`, error.message);
    
    // Save health state
    await saveServerHealth();
    return false;
  }
}

async function forwardToPterodactyl(phoneNumber, isPremium = false) {
  const selectedServer = isPremium ? getNextAvailablePremiumServer() : getNextAvailableServer();
  
  if (!selectedServer) {
    throw new Error(isPremium ? 'No premium servers are currently available' : 'No backend servers are currently available');
  }
  
  console.log(`ð¯ Forwarding request to ${selectedServer.isPremium ? 'Premium ' : ''}Server ${selectedServer.index + 1}: ${selectedServer.url}`);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);

    const response = await fetch(`${selectedServer.url}/request-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status >= 500) {
        if (selectedServer.isPremium) {
          premiumServerHealth[selectedServer.index].healthy = false;
        } else {
          serverHealth[selectedServer.index].healthy = false;
        }
        
        // Save health state and schedule recheck
        await saveServerHealth();
        setTimeout(() => checkServerHealth(selectedServer.url, selectedServer.index, selectedServer.isPremium), 5000);
      }
      throw new Error(data.error || `Server responded with status: ${response.status}`);
    }
    
    // Update session count for the server
    if (selectedServer.isPremium) {
      premiumServerHealth[selectedServer.index].sessions += 1;
    } else {
      serverHealth[selectedServer.index].sessions += 1;
    }
    await saveServerHealth();
    
    return {
      ...data,
      serverUsed: selectedServer.index + 1,
      serverUrl: selectedServer.url,
      isPremium: selectedServer.isPremium
    };
    
  } catch (error) {
    if (selectedServer.isPremium) {
      premiumServerHealth[selectedServer.index].healthy = false;
    } else {
      serverHealth[selectedServer.index].healthy = false;
    }
    console.log(`â Server ${selectedServer.index + 1} failed, marking as unhealthy: ${error.message}`);
    
    // Save health state and schedule recheck
    await saveServerHealth();
    setTimeout(() => checkServerHealth(selectedServer.url, selectedServer.index, selectedServer.isPremium), 5000);
    
    throw error;
  }
}

// Update the visitor count endpoint
app.post('/visitor-heartbeat', (req, res) => {
  const { visitorId } = req.body;
  
  if (visitorId) {
    activeVisitors.set(visitorId, Date.now());
    res.json({ 
      success: true, 
      activeVisitors: activeVisitors.size 
    });
  } else {
    res.status(400).json({ 
      success: false, 
      error: 'Visitor ID required' 
    });
  }
});

// Update the bot-counts endpoint to include visitor count
app.get('/bot-counts', async (req, res) => {
  try {
    let regularBotCount = 0;
    let premiumBotCount = 0;
    const serverCounts = {
      regular: [],
      premium: []
    };
    
    // Count regular bots
    const regularPromises = BACKEND_SERVERS.map(async (serverUrl, i) => {
      let count = 0;
      if (serverHealth[i].healthy) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${serverUrl}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          clearTimeout(timeout);
          
          if (response.ok) {
            const data = await response.json();
            count = data.success && data.sessions ? data.sessions.length : 0;
            regularBotCount += count;
          }
        } catch (error) {
          console.log(`Failed to count bots from regular server ${i + 1}`);
        }
      }
      
      return {
        serverIndex: i + 1,
        count: count,
        status: serverHealth[i].healthy ? 'online' : 'offline',
        sessions: serverHealth[i].sessions,
        maxSessions: serverHealth[i].maxSessions
      };
    });
    
    // Count premium bots
    const premiumPromises = PREMIUM_SERVERS.map(async (serverUrl, i) => {
      let count = 0;
      if (premiumServerHealth[i].healthy) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${serverUrl}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          clearTimeout(timeout);
          
          if (response.ok) {
            const data = await response.json();
            count = data.success && data.sessions ? data.sessions.length : 0;
            premiumBotCount += count;
          }
        } catch (error) {
          console.log(`Failed to count bots from premium server ${i + 1}`);
        }
      }
      
      return {
        serverIndex: i + 1,
        count: count,
        status: premiumServerHealth[i].healthy ? 'online' : 'offline',
        sessions: premiumServerHealth[i].sessions,
        maxSessions: premiumServerHealth[i].maxSessions
      };
    });
    
    // Wait for all promises to resolve
    const [regularResults, premiumResults] = await Promise.all([
      Promise.all(regularPromises),
      Promise.all(premiumPromises)
    ]);
    
    serverCounts.regular = regularResults;
    serverCounts.premium = premiumResults;
    
    const totalBotCount = regularBotCount + premiumBotCount;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      botCounts: {
        total: totalBotCount,
        regular: regularBotCount,
        premium: premiumBotCount,
        display: {
          total: `ð¤ ${totalBotCount} Total Active Bots`,
          regular: `${regularBotCount} Regular Bots`,
          premium: `â­ ${premiumBotCount} Premium Bots`,
          ratio: totalBotCount > 0 ? `${Math.round((premiumBotCount / totalBotCount) * 100)}% Premium` : '0% Premium'
        }
      },
      serverCounts: serverCounts,
      serverStatus: {
        regularServersOnline: Object.values(serverHealth).filter(h => h.healthy).length,
        premiumServersOnline: Object.values(premiumServerHealth).filter(h => h.healthy).length,
        totalServersOnline: Object.values(serverHealth).filter(h => h.healthy).length + Object.values(premiumServerHealth).filter(h => h.healthy).length
      },
      visitorCount: activeVisitors.size // Add visitor count
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bot counts',
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint for dashboard stats
app.get('/dashboard-stats', async (req, res) => {
  try {
    // Get quick stats without full session details
    const response = await fetch(`http://localhost:${PORT}/bot-counts`);
    const botData = await response.json();
    
    if (!botData.success) {
      throw new Error('Failed to get bot counts');
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        bots: botData.botCounts,
        servers: {
          total: BACKEND_SERVERS.length + PREMIUM_SERVERS.length,
          regular: {
            total: BACKEND_SERVERS.length,
            healthy: Object.values(serverHealth).filter(h => h.healthy).length,
            percentage: Math.round((Object.values(serverHealth).filter(h => h.healthy).length / BACKEND_SERVERS.length) * 100)
          },
          premium: {
            total: PREMIUM_SERVERS.length,
            healthy: Object.values(premiumServerHealth).filter(h => h.healthy).length,
            percentage: Math.round((Object.values(premiumServerHealth).filter(h => h.healthy).length / PREMIUM_SERVERS.length) * 100)
          }
        },
        uptime: {
          seconds: Math.floor(process.uptime()),
          formatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
        },
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard stats',
      timestamp: new Date().toISOString
    });
  }
});

// API endpoint to get server status with session counts
app.get('/server-status', async (req, res) => {
  try {
    const serverStatus = {
      regular: [],
      premium: [],
      timestamp: new Date().toISOString()
    };
    
    // Get regular server status
    for (let i = 0; i < BACKEND_SERVERS.length; i++) {
      serverStatus.regular.push({
        serverIndex: i + 1,
        serverUrl: BACKEND_SERVERS[i],
        healthy: serverHealth[i].healthy,
        sessions: serverHealth[i].sessions,
        maxSessions: serverHealth[i].maxSessions,
        status: serverHealth[i].healthy ? 
               (serverHealth[i].sessions >= serverHealth[i].maxSessions ? 'full' : 'available') : 
               'offline'
      });
    }
    
    // Get premium server status
    for (let i = 0; i < PREMIUM_SERVERS.length; i++) {
      serverStatus.premium.push({
        serverIndex: i + 1,
        serverUrl: PREMIUM_SERVERS[i],
        healthy: premiumServerHealth[i].healthy,
        sessions: premiumServerHealth[i].sessions,
        maxSessions: premiumServerHealth[i].maxSessions,
        status: premiumServerHealth[i].healthy ? 
               (premiumServerHealth[i].sessions >= premiumServerHealth[i].maxSessions ? 'full' : 'available') : 
               'offline'
      });
    }
    
    res.json({
      success: true,
      serverStatus: serverStatus
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve server status'
    });
  }
});

// Comments API endpoints
app.get('/comments', (req, res) => {
  res.json({
    success: true,
    comments: comments
  });
});

app.post('/comments', (req, res) => {
  try {
    const { user, text, image } = req.body;
    
    if (!user || !text) {
      return res.status(400).json({ error: 'User and text are required' });
    }
    
    const newComment = {
      id: Date.now(),
      user,
      text,
      time: new Date().toLocaleString(),
      likes: 0,
      image: image || null,
      replies: []
    };
    
    comments.unshift(newComment);
    saveComments();
    
    res.json({
      success: true,
      comment: newComment
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.post('/comments/:id/reply', (req, res) => {
  try {
    const { id } = req.params;
    const { user, text } = req.body;
    
    if (!user || !text) {
      return res.status(400).json({ error: 'User and text are required' });
    }
    
    const comment = comments.find(c => c.id == id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (!comment.replies) {
      comment.replies = [];
    }
    
    const reply = {
      user,
      text,
      time: new Date().toLocaleString(),
      likes: 0
    };
    
    comment.replies.push(reply);
    saveComments();
    
    res.json({
      success: true,
      reply
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

app.post('/comments/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    
    const comment = comments.find(c => c.id == id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    comment.likes = (comment.likes || 0) + 1;
    saveComments();
    
    res.json({
      success: true,
      likes: comment.likes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

app.post('/comments/:id/emoji', (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }
    
    const comment = comments.find(c => c.id == id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (!comment.emojis) {
      comment.emojis = {};
    }
    
    comment.emojis[emoji] = (comment.emojis[emoji] || 0) + 1;
    saveComments();
    
    res.json({
      success: true,
      emojis: comment.emojis
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add emoji reaction' });
  }
});

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (users[username] && users[username].password === password) {
    req.user = { username, isAdmin: users[username].isAdmin };
    next();
  } else {
    // Track failed attempts
    const attemptKey = `${req.ip}-${username}`;
    const attempts = failedAttempts.get(attemptKey) || 0;
    failedAttempts.set(attemptKey, attempts + 1);
    
    // Set cooldown for 1 minute after 3 failed attempts
    if (attempts >= 2) {
      setTimeout(() => failedAttempts.delete(attemptKey), 60000);
      return res.status(429).json({ 
        error: 'Too many failed attempts. Please try again in 1 minute.' 
      });
    }
    
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// API endpoint to request pairing code
app.post('/request-pairing', async (req, res) => {
  try {
    const { phoneNumber, premiumKey } = req.body;
    let isPremium = false;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // Check for premium access
    if (premiumKey) {
      // Trim and clean the key
      const cleanedKey = premiumKey.trim().toLowerCase();
      
      if (validatePremiumKey(cleanedKey)) {
        isPremium = true;
        console.log(`â­ Premium key access used: ${cleanedKey}`);
        
        // If it's a valid format but not in our stored keys, add it
        if (!premiumKeys.has(cleanedKey)) {
          premiumKeys.add(cleanedKey);
          savePremiumKeys(); // Save to permanent storage
          console.log(`â Added new premium key to storage: ${cleanedKey}`);
        }
      } else {
        console.log(`â Invalid premium key format: ${cleanedKey}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid premium key'
        });
      }
    }
    
    console.log(`ð Processing ${isPremium ? 'premium ' : ''}pairing request for: ${validation.number}`);
    
    // Forward request to the appropriate server
    const result = await forwardToPterodactyl(validation.number, isPremium);
    
    // Process the response to add copy support for 8-digit codes
    const processedResult = processPairingCodeResponse(result);
    
    console.log(`â Pairing code generated successfully for ${validation.number} via ${isPremium ? 'Premium ' : ''}Server ${result.serverUsed}`);
    
    // Log if code is copyable
    if (processedResult.canCopy) {
      console.log(`ð 8-digit code generated - copy feature enabled: ${processedResult.rawCode}`);
    }
    
    res.json(processedResult);
    
  } catch (error) {
    console.error('â Error processing pairing request:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate pairing code'
    });
  }
});

// Admin API endpoints
app.post('/admin/generate-key', requireAuth, requireAdmin, (req, res) => {
  const key = generatePremiumKey();
  res.json({ success: true, key });
});

app.get('/admin/keys', requireAuth, requireAdmin, (req, res) => {
  res.json({ success: true, keys: Array.from(premiumKeys) });
});

app.post('/admin/add-user', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, isAdmin = false } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (users[username]) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    users[username] = { password, isAdmin };
    await saveUsers();
    
    res.json({ 
      success: true, 
      message: `User '${username}' created successfully`,
      user: { username, isAdmin }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/admin/users/:username', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (username === 'kingbadboi') {
      return res.status(403).json({ error: 'Cannot delete the default admin user' });
    }
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    delete users[username];
    await saveUsers();
    
    res.json({ 
      success: true, 
      message: `User '${username}' deleted successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const userList = Object.keys(users).map(username => ({
    username,
    isAdmin: users[username].isAdmin,
    createdAt: users[username].createdAt || 'Unknown'
  }));
  
  res.json({ success: true, users: userList });
});

// API endpoint to get sessions from all servers
app.get('/sessions', async (req, res) => {
  try {
    const allSessions = [];
    let regularBotCount = 0;
    let premiumBotCount = 0;
    const serverStats = {
      regular: [],
      premium: []
    };
    
    // Check regular servers
    for (let i = 0; i < BACKEND_SERVERS.length; i++) {
      let serverSessionCount = 0;
      if (serverHealth[i].healthy) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(`${BACKEND_SERVERS[i]}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          clearTimeout(timeout);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.sessions) {
              serverSessionCount = data.sessions.length;
              regularBotCount += serverSessionCount;
              
              data.sessions.forEach(session => {
                allSessions.push({
                  ...session,
                  serverIndex: i + 1,
                  serverUrl: BACKEND_SERVERS[i],
                  isPremium: false,
                  botType: 'regular'
                });
              });
            }
          }
        } catch (error) {
          console.log(`Failed to get sessions from server ${i + 1}:`, error.message);
        }
      }
      
      serverStats.regular.push({
        serverIndex: i + 1,
        serverUrl: BACKEND_SERVERS[i],
        botCount: serverSessionCount,
        isHealthy: serverHealth[i].healthy,
        sessions: serverHealth[i].sessions,
        maxSessions: serverHealth[i].maxSessions,
        status: serverHealth[i].healthy ? 
               (serverHealth[i].sessions >= serverHealth[i].maxSessions ? 'full' : 'available') : 
               'offline'
      });
    }
    
    // Check premium servers
    for (let i = 0; i < PREMIUM_SERVERS.length; i++) {
      let serverSessionCount = 0;
      if (premiumServerHealth[i].healthy) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(`${PREMIUM_SERVERS[i]}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          clearTimeout(timeout);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.sessions) {
              serverSessionCount = data.sessions.length;
              premiumBotCount += serverSessionCount;
              
              data.sessions.forEach(session => {
                allSessions.push({
                  ...session,
                  serverIndex: i + 1,
                  serverUrl: PREMIUM_SERVERS[i],
                  isPremium: true,
                  botType: 'premium'
                });
              });
            }
          }
        } catch (error) {
          console.log(`Failed to get sessions from premium server ${i + 1}:`, error.message);
        }
      }
      
      serverStats.premium.push({
        serverIndex: i + 1,
        serverUrl: PREmium_SERVERS[i],
        botCount: serverSessionCount,
        isHealthy: premiumServerHealth[i].healthy,
        sessions: premiumServerHealth[i].sessions,
        maxSessions: premiumServerHealth[i].maxSessions,
        status: premiumServerHealth[i].healthy ? 
               (premiumServerHealth[i].sessions >= premiumServerHealth[i].maxSessions ? 'full' : 'available') : 
               'offline'
      });
    }
    
    const totalBotCount = regularBotCount + premiumBotCount;
    
    res.json({
      success: true,
      sessions: allSessions,
      botCounts: {
        total: totalBotCount,
        regular: regularBotCount,
        premium: premiumBotCount,
        breakdown: {
          regularBots: `${regularBotCount} Regular Bots`,
          premiumBots: `â­ ${premiumBotCount} Premium Bots`,
          totalBots: `ð¤ ${totalBotCount} Total Active Bots`
        }
      },
      serverStats: serverStats,
      summary: {
        totalSessions: allSessions.length,
        regularSessions: allSessions.filter(s => !s.isPremium).length,
        premiumSessions: allSessions.filter(s => s.isPremium).length,
        healthyRegularServers: Object.values(serverHealth).filter(h => h.healthy).length,
        healthyPremiumServers: Object.values(premiumServerHealth).filter(h => h.healthy).length,
        totalRegularServers: BACKEND_SERVERS.length,
        totalPremiumServers: PREMIUM_SERVERS.length
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthyServers = Object.values(serverHealth).filter(h => h.healthy).length;
  const healthyPremiumServers = Object.values(premiumServerHealth).filter(h => h.healthy).length;
  
  // Get current bot counts
  let regularBotCount = 0;
  let premiumBotCount = 0;
  
  try {
    // Quick bot count from all servers
    const botCountPromises = [];
    
    // Count regular bots
    for (let i = 0; i < BACKEND_SERVERS.length; i++) {
      if (serverHealth[i].healthy) {
        botCountPromises.push(
          fetch(`${BACKEND_SERVERS[i]}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          }).then(response => response.json())
            .then(data => data.success && data.sessions ? data.sessions.length : 0)
            .catch(() => 0)
        );
      }
    }
    
    // Count premium bots
    for (let i = 0; i < PREMIUM_SERVERS.length; i++) {
      if (premiumServerHealth[i].healthy) {
        botCountPromises.push(
          fetch(`${PREMIUM_SERVERS[i]}/sessions`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          }).then(response => response.json())
            .then(data => data.success && data.sessions ? data.sessions.length : 0)
            .catch(() => 0)
        );
      }
    }
    
    const botCounts = await Promise.allSettled(botCountPromises);
    const regularServerCount = BACKEND_SERVERS.filter((_, i) => serverHealth[i].healthy).length;
    
    botCounts.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (index < regularServerCount) {
          regularBotCount += result.value;
        } else {
          premiumBotCount += result.value;
        }
      }
    });
    
  } catch (error) {
    console.log('Error getting bot counts for health check:', error.message);
  }
  
  const totalBotCount = regularBotCount + premiumBotCount;
  
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Frontend proxy server is running',
    backendServers: {
      total: BACKEND_SERVERS.length,
      healthy: healthyServers,
      urls: BACKEND_SERVERS
    },
    premiumServers: {
      total: PREMIUM_SERVERS.length,
      healthy: healthyPremiumServers,
      urls: PREMIUM_SERVERS
    },
    botCounts: {
      total: totalBotCount,
      regular: regularBotCount,
      premium: premiumBotCount,
      formatted: {
        total: `ð¤ ${totalBotCount} Total Bots Active`,
        regular: `${regularBotCount} Regular Bots`,
        premium: `â­ ${premiumBotCount} Premium Bots`
      }
    },
    performance: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      serverLoad: `${healthyServers + healthyPremiumServers}/${BACKEND_SERVERS.length + PREMIUM_SERVERS.length} servers online`
    },
    database: {
      status: 'active',
      dataDirectory: DATA_DIR,
      filesPresent: {
        users: await fs.access(USERS_FILE).then(() => true).catch(() => false),
        keys: await fs.access(KEYS_FILE).then(() => true).catch(() => false),
        comments: await fs.access(COMMENTS_FILE).then(() => true).catch(() => false),
        serverHealth: await fs.access(SERVER_HEALTH_FILE).then(() => true).catch(() => false),
        config: await fs.access(CONFIG_FILE).then(() => true).catch(() => false)
      }
    },
    visitorCount: activeVisitors.size
  });
});

app.post('/admin/backup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      users: users,
      premiumKeys: Array.from(premiumKeys),
      comments: comments,
      serverHealth: {
        regular: serverHealth,
        premium: premiumServerHealth
      },
      config: {
        roundRobinCounters: {
          regular: currentServerIndex,
          premium: currentPremiumServerIndex
        }
      }
    };
    
    const backupFileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupPath = path.join(DATA_DIR, 'backups');
    
    // Ensure backup directory exists
    await fs.mkdir(backupPath, { recursive: true });
    
    // Save backup
    await fs.writeFile(
      path.join(backupPath, backupFileName), 
      JSON.stringify(backupData, null, 2), 
      'utf8'
    );
    
    res.json({
      success: true,
      message: 'Backup created successfully',
      filename: backupFileName,
      path: path.join(backupPath, backupFileName)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
});

// Restore endpoint
app.post('/admin/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    
    const backupPath = path.join(DATA_DIR, 'backups', filename);
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    
    // Restore data
    if (backupData.users) {
      users = backupData.users;
      await saveUsers();
    }
    
    if (backupData.premiumKeys) {
      premiumKeys = new Set(backupData.premiumKeys);
      await savePremiumKeys();
    }
    
    if (backupData.comments) {
      comments = backupData.comments;
      await saveComments();
    }
    
    if (backupData.serverHealth) {
      Object.keys(backupData.serverHealth.regular || {}).forEach(index => {
        if (serverHealth[index]) {
          serverHealth[index].healthy = backupData.serverHealth.regular[index].healthy;
          serverHealth[index].sessions = backupData.serverHealth.regular[index].sessions || 0;
        }
      });
      Object.keys(backupData.serverHealth.premium || {}).forEach(index => {
        if (premiumServerHealth[index]) {
          premiumServerHealth[index].healthy = backupData.serverHealth.premium[index].healthy;
          premiumServerHealth[index].sessions = backupData.serverHealth.premium[index].sessions || 0;
        }
      });
      await saveServerHealth();
    }
    
    if (backupData.config && backupData.config.roundRobinCounters) {
      currentServerIndex = backupData.config.roundRobinCounters.regular || 0;
      currentPremiumServerIndex = backupData.config.roundRobinCounters.premium || 0;
      await saveConfig();
    }
    
    res.json({
      success: true,
      message: 'Data restored successfully from backup',
      restoredFrom: filename,
      timestamp: backupData.timestamp
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to restore from backup'
    });
  }
});

// List backups endpoint
app.get('/admin/backups', requireAuth, requireAdmin, async (req, res) => {
  try {
    const backupPath = path.join(DATA_DIR, 'backups');
    
    try {
      const files = await fs.readdir(backupPath);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(backupPath, file);
          const stats = await fs.stat(filePath);
          
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            backups.push({
              filename: file,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              timestamp: data.timestamp || 'Unknown',
              hasUsers: !!data.users,
              hasKeys: !!data.premiumKeys,
              hasComments: !!data.comments,
              hasServerHealth: !!data.serverHealth,
              hasConfig: !!data.config
            });
          } catch (parseError) {
            console.log(`Failed to parse backup file ${file}:`, parseError.message);
          }
        }
      }
      
      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      res.json({
        success: true,
        backups: backups,
        totalBackups: backups.length
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          backups: [],
          totalBackups: 0,
          message: 'No backups directory found'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list backups'
    });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`ð WhatsApp Pairing Proxy Server running on port ${PORT}`);
  console.log(`ð Frontend URL: http://localhost:${PORT}`);
  console.log(`ð Backend servers: ${BACKEND_SERVERS.join(', ')}`);
  console.log(`â­ Premium servers: ${PREMIUM_SERVERS.join(', ')}`);
  console.log(`ð Admin login: username=kingbadboi, password=08140825959`);
  console.log(`ð Copy feature enabled for 8-digit pairing codes`);
  console.log(`ð¾ Database persistence enabled in: ${DATA_DIR}/`);
  console.log(`ð¥ Visitor tracking enabled with timeout: ${VISITOR_TIMEOUT/60000} minutes`);
  
  // Load data from files
  await loadData();
  
  // Initialize health checks
  await initializeHealthChecks();
  
  // Set up periodic health checks every 30 seconds
  setInterval(initializeHealthChecks, 30000);
  
  // Set up periodic data saves every 5 minutes
  setInterval(saveData, 300000);
});

// Initialize server health checks
async function initializeHealthChecks() {
  console.log('ð¥ Initializing server health checks...');
  
  const healthPromises = BACKEND_SERVERS.map((server, index) => 
    checkServerHealth(server, index, false)
  );
  
  const premiumHealthPromises = PREMIUM_SERVERS.map((server, index) => 
    checkServerHealth(server, index, true)
  );
  
  await Promise.allSettled([...healthPromises, ...premiumHealthPromises]);
  
  const healthyCount = Object.values(serverHealth).filter(h => h.healthy).length;
  const healthyPremiumCount = Object.values(premiumServerHealth).filter(h => h.healthy).length;
  
  console.log(`ð Health check complete: ${healthyCount}/${BACKEND_SERVERS.length} regular servers and ${healthyPremiumCount}/${PREMIUM_SERVERS.length} premium servers are healthy`);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nð Shutting down proxy server...');
  console.log('ð¾ Saving all data to persistent storage...');
  await saveData();
  console.log('â Data saved successfully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nð Proxy server terminated');
  console.log('ð¾ Saving all data to persistent storage...');
  await saveData();
  console.log('â Data saved successfully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('â Uncaught Exception:', error);
  console.log('ð¾ Emergency data save...');
  try {
    await saveData();
    console.log('â Emergency save completed');
  } catch (saveError) {
    console.error('â Failed to save data during emergency:', saveError);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('â Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('ð¾ Emergency data save...');
  try {
    await saveData();
    console.log('â Emergency save completed');
  } catch (saveError) {
    console.error('â Failed to save data during emergency:', saveError);
  }
});