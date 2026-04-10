// Base URL for API requests - adjust if needed
const API_BASE = window.location.origin;

// Local storage keys
const PREMIUM_KEYS_STORAGE = 'premiumKeys';
const ADMIN_CREDENTIALS = 'adminCredentials';
const COMMENTS_STORAGE = 'comments';
const USER_PREFS = 'userPreferences';

// Initialize runtime display
let startTime = Date.now();

function updateRuntime() {
    const now = Date.now();
    const diff = now - startTime;
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    document.getElementById('runtime').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
    // Update date
    const currentDate = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('en-US', options);
}

// Update runtime every second
setInterval(updateRuntime, 1000);
updateRuntime(); // Initial call

document.addEventListener('DOMContentLoaded', function() {
    // Initialize premium keys from localStorage
    initializePremiumKeys();
    
    // Load user preferences
    loadUserPreferences();
    
    // Load comments
    loadComments();
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    
    // Check for saved theme preference or respect OS preference
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        document.body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        } else {
            localStorage.setItem('theme', 'light');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    });
    
    // Page navigation functionality
    const pages = document.querySelectorAll('.page');
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    const backButtons = document.querySelectorAll('.back-to-dashboard');
    const pageButtons = document.querySelectorAll('.page-btn');
    const heroCtaButtons = document.querySelectorAll('.hero-cta .btn');
    
    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // Update active page button
        pageButtons.forEach(btn => {
            if (btn.getAttribute('data-page') === pageId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Load tutorial video when tutorial page is opened
        if (pageId === 'tutorialPage') {
            loadTutorialVideo();
        }
    }
    
    // Dashboard card click events
    dashboardCards.forEach(card => {
        card.addEventListener('click', () => {
            const pageId = card.getAttribute('data-page');
            showPage(pageId);
        });
    });
    
    // Hero CTA button events
    heroCtaButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.getAttribute('data-page');
            showPage(pageId);
        });
    });
    
    // Page button click events
    pageButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.getAttribute('data-page');
            showPage(pageId);
        });
    });
    
    // Back button click events
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            showPage('dashboardPage');
        });
    });
    
    // Admin button functionality
    const adminBtn = document.getElementById('adminBtn');
    adminBtn.addEventListener('click', () => {
        showPage('adminPage');
    });
    
    // Premium button functionality
    const premiumBtn = document.getElementById('premiumBtn');
    premiumBtn.addEventListener('click', () => {
        showPage('premiumPage');
    });
    
    // Logout functionality
    const premiumLogoutBtn = document.getElementById('premiumLogoutBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    
    premiumLogoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('premiumKey');
        document.getElementById('premiumPairingSection').style.display = 'none';
        document.getElementById('premiumLoginResult').innerHTML = '';
        document.getElementById('premiumKey').value = '';
        showPage('dashboardPage');
    });
    
    adminLogoutBtn.addEventListener('click', () => {
        document.getElementById('adminFeatures').style.display = 'none';
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminResults').innerHTML = '';
        showPage('dashboardPage');
    });
    
    // Free form submission
    const freePairingForm = document.getElementById('freePairingForm');
    const freeResultContainer = document.getElementById('freeResultContainer');
    const freeErrorContainer = document.getElementById('freeErrorContainer');
    const freePairingCode = document.getElementById('freePairingCode');
    const freeCopyBtn = document.getElementById('freeCopyBtn');
    const freeSubmitBtn = document.getElementById('freeSubmitBtn');
    
    freePairingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phoneNumber = document.getElementById('freePhoneNumber').value;
        
        // Basic validation
        if (!phoneNumber) {
            showError('Phone number is required', freeErrorContainer);
            return;
        }
        
        // Clear previous results
        freeErrorContainer.style.display = 'none';
        freeResultContainer.style.display = 'none';
        
        // Show loading state
        const originalText = freeSubmitBtn.innerHTML;
        freeSubmitBtn.innerHTML = '<span class="loading"></span> Processing...';
        freeSubmitBtn.disabled = true;
        
        try {
            // Prepare request data
            const requestData = {
                phoneNumber: phoneNumber
            };
            
            // Make API call to backend
            const response = await fetch(`${API_BASE}/request-pairing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Display the pairing code
                freePairingCode.textContent = data.formattedCode || data.pairingCode;
                freeResultContainer.style.display = 'block';
                
                // Add copy functionality if it's an 8-digit code
                if (data.canCopy || data.copyEnabled) {
                    freeCopyBtn.style.display = 'block';
                    // Store the raw code for copying
                    freePairingCode.dataset.rawCode = data.rawCode || data.pairingCode;
                } else {
                    freeCopyBtn.style.display = 'none';
                }
            } else {
                showError(data.error || 'Failed to generate pairing code', freeErrorContainer);
            }
        } catch (error) {
            showError('Network error. Please try again.', freeErrorContainer);
            console.error('API Error:', error);
        } finally {
            // Restore button state
            freeSubmitBtn.innerHTML = originalText;
            freeSubmitBtn.disabled = false;
        }
    });
    
    // Premium login functionality
    document.getElementById('premiumLoginBtn').addEventListener('click', async () => {
        const premiumKey = document.getElementById('premiumKey').value;
        const premiumLoginResult = document.getElementById('premiumLoginResult');
        const premiumPairingSection = document.getElementById('premiumPairingSection');
        
        if (!premiumKey) {
            premiumLoginResult.innerHTML = '<div style="color: var(--error); padding: 10px; border-radius: 8px; background: rgba(244, 67, 54, 0.1);">Premium key is required</div>';
            return;
        }
        
        // Validate key format
        if (!validatePremiumKey(premiumKey)) {
            premiumLoginResult.innerHTML = '<div style="color: var(--error); padding: 10px; border-radius: 8px; background: rgba(244, 67, 54, 0.1;">Invalid key format</div>';
            return;
        }
        
        // Show loading state
        const loginBtn = document.getElementById('premiumLoginBtn');
        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="loading"></span> Verifying...';
        loginBtn.disabled = true;
        
        try {
            // Check if key exists in localStorage
            const premiumKeys = JSON.parse(localStorage.getItem(PREMIUM_KEYS_STORAGE) || '[]');
            
            if (premiumKeys.includes(premiumKey)) {
                premiumLoginResult.innerHTML = '<div style="color: var(--success); padding: 10px; border-radius: 8px; background: rgba(76, 175, 80, 0.1);">Premium access confirmed! You can now use premium features.</div>';
                premiumPairingSection.style.display = 'block';
                
                // Store premium key in session
                sessionStorage.setItem('premiumKey', premiumKey);
            } else {
                premiumLoginResult.innerHTML = '<div style="color: var(--error); padding: 10px; border-radius: 8px; background: rgba(244, 67, 54, 0.1);">Invalid premium key</div>';
            }
        } catch (error) {
            premiumLoginResult.innerHTML = '<div style="color: var(--error); padding: 10px; border-radius: 8px; background: rgba(244, 67, 54, 0.1);">Error verifying key</div>';
            console.error('Premium login error:', error);
        } finally {
            // Restore button state
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });
    
    // Premium form submission
    const premiumPairingForm = document.getElementById('premiumPairingForm');
    const premiumResultContainer = document.getElementById('premiumResultContainer');
    const premiumErrorContainer = document.getElementById('premiumErrorContainer');
    const premiumPairingCode = document.getElementById('premiumPairingCode');
    const premiumCopyBtn = document.getElementById('premiumCopyBtn');
    const premiumSubmitBtn = document.getElementById('premiumSubmitBtn');
    
    premiumPairingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phoneNumber = document.getElementById('premiumPhoneNumber').value;
        const premiumKey = sessionStorage.getItem('premiumKey');
        
        if (!premiumKey) {
            showError('Please login with premium key first', premiumErrorContainer);
            return;
        }
        
        // Basic validation
        if (!phoneNumber) {
            showError('Phone number is required', premiumErrorContainer);
            return;
        }
        
        // Clear previous results
        premiumErrorContainer.style.display = 'none';
        premiumResultContainer.style.display = 'none';
        
        // Show loading state
        const originalText = premiumSubmitBtn.innerHTML;
        premiumSubmitBtn.innerHTML = '<span class="loading"></span> Processing...';
        premiumSubmitBtn.disabled = true;
        
        try {
            // Prepare request data
            const requestData = {
                phoneNumber: phoneNumber,
                premiumKey: premiumKey
            };
            
            // Make API call to backend
            const response = await fetch(`${API_BASE}/request-pairing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Display the pairing code
                premiumPairingCode.textContent = data.formattedCode || data.pairingCode;
                premiumResultContainer.style.display = 'block';
                
                // Add copy functionality if it's an 8-digit code
                if (data.canCopy || data.copyEnabled) {
                    premiumCopyBtn.style.display = 'block';
                    // Store the raw code for copying
                    premiumPairingCode.dataset.rawCode = data.rawCode || data.pairingCode;
                } else {
                    premiumCopyBtn.style.display = 'none';
                }
            } else {
                showError(data.error || 'Failed to generate pairing code', premiumErrorContainer);
            }
        } catch (error) {
            showError('Network error. Please try again.', premiumErrorContainer);
            console.error('API Error:', error);
        } finally {
            // Restore button state
            premiumSubmitBtn.innerHTML = originalText;
            premiumSubmitBtn.disabled = false;
        }
    });
    
    // Copy functionality
    const setupCopyButton = (copyBtn, pairingCode) => {
        copyBtn.addEventListener('click', () => {
            const code = pairingCode.dataset.rawCode || pairingCode.textContent;
            navigator.clipboard.writeText(code).then(() => {
                // Show copied feedback
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                }, 2000);
            });
        });
    };
    
    setupCopyButton(freeCopyBtn, freePairingCode);
    setupCopyButton(premiumCopyBtn, premiumPairingCode);
    
    // Music player functionality
    const audio = new Audio('https://files.catbox.moe/39yyvm.mp3');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = playPauseBtn.querySelector('i');
    
    playPauseBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
        } else {
            audio.pause();
            playIcon.classList.remove('fa-pause');
            playIcon.classList.add('fa-play');
        }
    });
    
    // Video player functionality
    const tutorialVideo = document.getElementById('tutorialVideo');
    const playPauseVideoBtn = document.getElementById('playPauseVideoBtn');
    const playPauseVideoIcon = playPauseVideoBtn.querySelector('i');
    const rewindVideoBtn = document.getElementById('rewindVideoBtn');
    const forwardVideoBtn = document.getElementById('forwardVideoBtn');
    const stopVideoBtn = document.getElementById('stopVideoBtn');
    const videoProgressContainer = document.getElementById('videoProgressContainer');
    const videoProgressBar = document.getElementById('videoProgressBar');
    const videoTimeDisplay = document.getElementById('videoTimeDisplay');
    const loadVideoBtn = document.getElementById('loadVideoBtn');
    
    // Load tutorial video
    function loadTutorialVideo() {
        const videoUrl = document.getElementById('videoUrl').value || 'https://files.catbox.moe/416frq.mp4';
        tutorialVideo.src = videoUrl;
        tutorialVideo.load();
        videoTimeDisplay.textContent = '00:00 / 00:00';
        videoProgressBar.style.width = '0%';
        playPauseVideoIcon.classList.remove('fa-pause');
        playPauseVideoIcon.classList.add('fa-play');
    }
    
    // Load video from URL input
    loadVideoBtn.addEventListener('click', () => {
        loadTutorialVideo();
    });
    
    // Play/Pause video
    playPauseVideoBtn.addEventListener('click', () => {
        if (tutorialVideo.paused) {
            tutorialVideo.play();
            playPauseVideoIcon.classList.remove('fa-play');
            playPauseVideoIcon.classList.add('fa-pause');
        } else {
            tutorialVideo.pause();
            playPauseVideoIcon.classList.remove('fa-pause');
            playPauseVideoIcon.classList.add('fa-play');
        }
    });
    
    // Rewind video
    rewindVideoBtn.addEventListener('click', () => {
        tutorialVideo.currentTime = Math.max(0, tutorialVideo.currentTime - 10);
    });
    
    // Forward video
    forwardVideoBtn.addEventListener('click', () => {
        tutorialVideo.currentTime = Math.min(tutorialVideo.duration, tutorialVideo.currentTime + 10);
    });
    
    // Stop video
    stopVideoBtn.addEventListener('click', () => {
        tutorialVideo.pause();
        tutorialVideo.currentTime = 0;
        playPauseVideoIcon.classList.remove('fa-pause');
        playPauseVideoIcon.classList.add('fa-play');
    });
    
    // Update progress bar
    tutorialVideo.addEventListener('timeupdate', () => {
        const progress = (tutorialVideo.currentTime / tutorialVideo.duration) * 100;
        videoProgressBar.style.width = `${progress}%`;
        
        // Update time display
        const currentTime = formatTime(tutorialVideo.currentTime);
        const duration = formatTime(tutorialVideo.duration);
        videoTimeDisplay.textContent = `${currentTime} / ${duration}`;
    });
    
    // Seek video on progress bar click
    videoProgressContainer.addEventListener('click', (e) => {
        const rect = videoProgressContainer.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        tutorialVideo.currentTime = clickPosition * tutorialVideo.duration;
    });
    
    // Format time function
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Load initial stats
    loadStats();
    
    // Admin login functionality
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminFeatures = document.getElementById('adminFeatures');
    const adminResults = document.getElementById('adminResults');
    
    adminLoginBtn.addEventListener('click', async () => {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        if (!username || !password) {
            adminResults.innerHTML = '<div style="color: var(--error);">Username and password are required</div>';
            return;
        }
        
        // Encode credentials for Basic Auth
        const credentials = btoa(`${username}:${password}`);
        
        try {
            // Test admin access by trying to generate a key
            const response = await fetch(`${API_BASE}/admin/generate-key`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });
            
            if (response.ok) {
                adminFeatures.style.display = 'block';
                adminResults.innerHTML = '<div style="color: var(--success);">Admin access granted</div>';
                
                // Store admin credentials in localStorage
                localStorage.setItem(ADMIN_CREDENTIALS, JSON.stringify({ username, password }));
            } else {
                adminResults.innerHTML = '<div style="color: var(--error);">Invalid admin credentials</div>';
            }
        } catch (error) {
            adminResults.innerHTML = '<div style="color: var(--error);">Error connecting to server</div>';
            console.error('Admin login error:', error);
        }
    });
    
    // Admin functionality
    document.getElementById('generateKeyBtn').addEventListener('click', async () => {
        await performAdminAction('generate-key', 'POST', 'Premium key generated successfully');
    });
    
    document.getElementById('viewKeysBtn').addEventListener('click', async () => {
        await performAdminAction('keys', 'GET', 'Keys retrieved successfully');
    });
    
    // Function to perform admin actions
    async function performAdminAction(endpoint, method, successMessage, data = null) {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        if (!username || !password) {
            adminResults.innerHTML = '<div style="color: var(--error);">Please login first</div>';
            return;
        }
        
        const credentials = btoa(`${username}:${password}`);
        
        try {
            const options = {
                method: method,
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            };
            
            if (data && method === 'POST') {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(`${API_BASE}/admin/${endpoint}`, options);
            const result = await response.json();
            
            if (response.ok) {
                adminResults.innerHTML = `<div style="color: var(--success); margin-bottom: 15px;">${successMessage}</div><pre style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px; overflow: auto;">${JSON.stringify(result, null, 2)}</pre>`;
                
                // If keys were generated, update localStorage
                if (endpoint === 'generate-key' && result.key) {
                    const premiumKeys = JSON.parse(localStorage.getItem(PREMIUM_KEYS_STORAGE) || '[]');
                    premiumKeys.push(result.key);
                    localStorage.setItem(PREMIUM_KEYS_STORAGE, JSON.stringify(premiumKeys));
                }
            } else {
                adminResults.innerHTML = `<div style="color: var(--error);">Error: ${result.error || 'Unknown error'}</div>`;
            }
        } catch (error) {
            adminResults.innerHTML = '<div style="color: var(--error);">Error connecting to server</div>';
            console.error('Admin action error:', error);
        }
    }
    
    // Function to show error messages
    function showError(message, errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
    
    // Function to load stats
    async function loadStats() {
        try {
            const response = await fetch(`${API_BASE}/bot-counts`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('totalBots').textContent = data.botCounts.total;
                document.getElementById('regularBots').textContent = data.botCounts.regular;
                document.getElementById('premiumBots').textContent = data.botCounts.premium;
                document.getElementById('serversOnline').textContent = 
                    `${data.serverStatus.totalServersOnline}/${data.serverStatus.regularServersOnline + data.serverStatus.premiumServersOnline}`;
                
                // Update server status display
                const serverStatusDiv = document.getElementById('serverStatus');
                serverStatusDiv.innerHTML = '';
                
                if (data.serverCounts && data.serverCounts.regular) {
                    data.serverCounts.regular.forEach(server => {
                        const serverEl = document.createElement('div');
                        serverEl.className = 'server-status';
                        serverEl.innerHTML = `
                            <span class="status-indicator ${server.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                            Regular Server ${server.serverIndex}: ${server.count} bots (${server.status})
                        `;
                        serverStatusDiv.appendChild(serverEl);
                    });
                }
                
                if (data.serverCounts && data.serverCounts.premium) {
                    data.serverCounts.premium.forEach(server => {
                        const serverEl = document.createElement('div');
                        serverEl.className = 'server-status';
                        serverEl.innerHTML = `
                            <span class="status-indicator ${server.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                            Premium Server ${server.serverIndex}: ${server.count} bots (${server.status})
                        `;
                        serverStatusDiv.appendChild(serverEl);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }
    
    // Function to validate premium key format
    function validatePremiumKey(key) {
        return /^(4|9).*(4qr|9we)$/.test(key);
    }
    
    // Function to initialize premium keys from localStorage
    function initializePremiumKeys() {
        if (!localStorage.getItem(PREMIUM_KEYS_STORAGE)) {
            localStorage.setItem(PREMIUM_KEYS_STORAGE, JSON.stringify([]));
        }
    }
    
    // Function to load user preferences
    function loadUserPreferences() {
        if (!localStorage.getItem(USER_PREFS)) {
            localStorage.setItem(USER_PREFS, JSON.stringify({}));
        }
    }
    
    // Enhanced comment functionality
    const commentImageBtn = document.getElementById('commentImageBtn');
    const commentImage = document.getElementById('commentImage');
    const imagePreview = document.getElementById('imagePreview');
    const imageFileName = document.getElementById('imageFileName');
    
    // Image upload button
    commentImageBtn.addEventListener('click', () => {
        commentImage.click();
    });
    
    // Handle image selection
    commentImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            imageFileName.textContent = file.name;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Post comment functionality
    document.getElementById('postCommentBtn').addEventListener('click', () => {
        const commentText = document.getElementById('commentInput').value;
        if (commentText.trim()) {
            addComment('You', commentText, imagePreview.src !== '' ? imagePreview.src : null);
            
            // Reset form
            document.getElementById('commentInput').value = '';
            imagePreview.style.display = 'none';
            imagePreview.src = '';
            imageFileName.textContent = '';
            commentImage.value = '';
        }
    });
    
    // Function to load comments from localStorage
    function loadComments() {
        const commentSection = document.getElementById('commentSection');
        commentSection.innerHTML = '';
        
        // Load comments from localStorage
        const comments = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '[]');
        
        if (comments.length === 0) {
            // Add sample comments if none exist
            const sampleComments = [
                { 
                    user: 'King Badboi', 
                    text: 'This is an amazing service! The pairing code worked perfectly.', 
                    time: '2 hours ago', 
                    likes: 15,
                    replies: [
                        { user: 'TechEnthusiast', text: 'I agree! Best service out there.', time: '1 hour ago', likes: 3 }
                    ]
                },
                { 
                    user: 'Premium User', 
                    text: 'The premium features are definitely worth it. Faster generation and more reliable.', 
                    time: '1 day ago', 
                    likes: 8,
                    image: 'https://files.catbox.moe/8h5cox.jpg'
                },
                { 
                    user: 'TechEnthusiast', 
                    text: 'Love the new interface! Much easier to use than before.', 
                    time: '3 days ago', 
                    likes: 5,
                    emojis: { 'â¤ï¸': 2, 'ð¥': 1 }
                }
            ];
            
            localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(sampleComments));
            comments.push(...sampleComments);
        }
        
        comments.forEach(comment => {
            addCommentToDOM(comment);
        });
    }
    
    // Function to add a comment to DOM
    function addCommentToDOM(comment) {
        const commentSection = document.getElementById('commentSection');
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.dataset.id = comment.id || Date.now();
        
        let imageHtml = '';
        if (comment.image) {
            imageHtml = `<img src="${comment.image}" class="comment-image" alt="Comment image">`;
        }
        
        let emojiHtml = '';
        if (comment.emojis) {
            emojiHtml = `<div class="emoji-reactions">`;
            for (const [emoji, count] of Object.entries(comment.emojis)) {
                emojiHtml += `<div class="emoji-reaction">${emoji} ${count}</div>`;
            }
            emojiHtml += `</div>`;
        }
        
        let repliesHtml = '';
        if (comment.replies && comment.replies.length > 0) {
            repliesHtml = `<div class="replies">`;
            comment.replies.forEach(reply => {
                repliesHtml += `
                    <div class="comment">
                        <div class="comment-header">
                            <span class="comment-user"><i class="fas fa-user"></i> ${reply.user}</span>
                            <span class="comment-time">${reply.time}</span>
                        </div>
                        <div class="comment-content">
                            <p>${reply.text}</p>
                        </div>
                        <div class="comment-actions">
                            <span class="comment-action"><i class="fas fa-heart"></i> Like (${reply.likes || 0})</span>
                            <span class="comment-action"><i class="fas fa-reply"></i> Reply</span>
                        </div>
                    </div>
                `;
            });
            repliesHtml += `</div>`;
        }
        
        commentEl.innerHTML = `
            <div class="comment-header">
                <span class="comment-user"><i class="fas fa-user"></i> ${comment.user}</span>
                <span class="comment-time">${comment.time}</span>
            </div>
            <div class="comment-content">
                <p>${comment.text}</p>
                ${imageHtml}
            </div>
            ${emojiHtml}
            <div class="comment-actions">
                <span class="comment-action"><i class="fas fa-heart"></i> Like (${comment.likes || 0})</span>
                <span class="comment-action"><i class="fas fa-smile"></i> Add Reaction</span>
                <span class="comment-action"><i class="fas fa-reply"></i> Reply</span>
            </div>
            ${repliesHtml}
        `;
        
        commentSection.prepend(commentEl);
        
        // Add event listeners for actions
        const likeBtn = commentEl.querySelector('.comment-action:nth-child(1)');
        const emojiBtn = commentEl.querySelector('.comment-action:nth-child(2)');
        const replyBtn = commentEl.querySelector('.comment-action:nth-child(3)');
        
        likeBtn.addEventListener('click', () => {
            const likes = parseInt(likeBtn.textContent.match(/\d+/)[0]) + 1;
            likeBtn.innerHTML = `<i class="fas fa-heart"></i> Like (${likes})`;
            
            // Update in localStorage
            updateCommentLikes(commentEl.dataset.id, likes);
        });
        
        emojiBtn.addEventListener('click', (e) => {
            const rect = emojiBtn.getBoundingClientRect();
            const picker = document.createElement('div');
            picker.className = 'emoji-picker';
            picker.style.left = `${rect.left}px`;
            picker.style.top = `${rect.top - 200}px`;
            
            const emojis = ['â¤ï¸', 'ð', 'ð®', 'ð¢', 'ð¡', 'ð', 'ð', 'ð¥', 'ð', 'ð¤', 'ð', 'ð'];
            emojis.forEach(emoji => {
                const emojiEl = document.createElement('span');
                emojiEl.className = 'emoji';
                emojiEl.textContent = emoji;
                emojiEl.addEventListener('click', () => {
                    addEmojiReaction(commentEl.dataset.id, emoji);
                    document.body.removeChild(picker);
                });
                picker.appendChild(emojiEl);
            });
            
            document.body.appendChild(picker);
            
            // Close picker when clicking outside
            setTimeout(() => {
                const closePicker = (e) => {
                    if (!picker.contains(e.target) && e.target !== emojiBtn) {
                        document.body.removeChild(picker);
                        document.removeEventListener('click', closePicker);
                    }
                };
                document.addEventListener('click', closePicker);
            }, 0);
        });
        
        replyBtn.addEventListener('click', () => {
            let replyForm = commentEl.querySelector('.reply-form');
            if (!replyForm) {
                replyForm = document.createElement('div');
                replyForm.className = 'reply-form';
                replyForm.innerHTML = `
                    <textarea class="form-control" placeholder="Write your reply..." rows="2"></textarea>
                    <button class="btn btn-primary" style="margin-top: 10px;">Post Reply</button>
                `;
                commentEl.appendChild(replyForm);
                
                const postReplyBtn = replyForm.querySelector('button');
                const replyTextarea = replyForm.querySelector('textarea');
                
                postReplyBtn.addEventListener('click', () => {
                    if (replyTextarea.value.trim()) {
                        addReply(commentEl.dataset.id, 'You', replyTextarea.value.trim());
                        replyForm.style.display = 'none';
                    }
                });
            }
            replyForm.style.display = replyForm.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Function to add a new comment
    function addComment(user, text, image = null) {
        const comment = {
            id: Date.now(),
            user: user,
            text: text,
            time: 'Just now',
            likes: 0,
            image: image
        };
        
        // Save to localStorage
        const comments = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '[]');
        comments.unshift(comment);
        localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(comments));
        
        // Add to DOM
        addCommentToDOM(comment);
    }
    
    // Function to update comment likes
    function updateCommentLikes(commentId, likes) {
        const comments = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '[]');
        const comment = comments.find(c => c.id == commentId);
        if (comment) {
            comment.likes = likes;
            localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(comments));
        }
    }
    
    // Function to add emoji reaction
    function addEmojiReaction(commentId, emoji) {
        const comments = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '[]');
        const comment = comments.find(c => c.id == commentId);
        if (comment) {
            if (!comment.emojis) {
                comment.emojis = {};
            }
            comment.emojis[emoji] = (comment.emojis[emoji] || 0) + 1;
            localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(comments));
            
            // Reload comments to update UI
            loadComments();
        }
    }
    
    // Function to add a reply
    function addReply(commentId, user, text) {
        const comments = JSON.parse(localStorage.getItem(COMMENTS_STORAGE) || '[]');
        const comment = comments.find(c => c.id == commentId);
        if (comment) {
            if (!comment.replies) {
                comment.replies = [];
            }
            comment.replies.push({
                user: user,
                text: text,
                time: 'Just now',
                likes: 0
            });
            localStorage.setItem(COMMENTS_STORAGE, JSON.stringify(comments));
            
            // Reload comments to update UI
            loadComments();
        }
    }
    
    // Load the tutorial video when the page loads
    loadTutorialVideo();
});
