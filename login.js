

        function createMusicNotes() {
            const notesContainer = document.getElementById('musicNotes');
            const noteSymbols = ['♪', '♫', '♬', '♩', '♭', '♮', '♯'];
            const noteCount = 20;

            for (let i = 0; i < noteCount; i++) {
                const note = document.createElement('div');
                note.className = 'music-note';

                // Random note symbol
                note.textContent = noteSymbols[Math.floor(Math.random() * noteSymbols.length)];

                // Random position
                const posX = Math.random() * window.innerWidth;
                const delay = Math.random() * 15;
                const duration = 10 + Math.random() * 15;
                const size = Math.random() * 1.5 + 0.8;

                // Set styles
                note.style.left = `${posX}px`;
                note.style.animationDuration = `${duration}s`;
                note.style.animationDelay = `${delay}s`;
                note.style.fontSize = `${size}em`;

                // Add to DOM
                notesContainer.appendChild(note);
            }
        }

        function detectDevTools(threshold = 160) {
            const start = performance.now();
            debugger;
            const end = performance.now();
            return (end - start) > threshold;
        }

        function checkDevTools() {
            if (detectDevTools()) {
                window.location.href = 'dead.html';
            } else {
                document.body.classList.remove('hidden');
            }
        }

        // Get IP and location information
        async function getIPInfo() {
            try {
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                return {
                    ip: data.ip || 'Unknown',
                    location: `${data.city || ''}, ${data.region || ''}, ${data.country_name || 'Unknown'}`
                };
            } catch (error) {
                console.error('Error fetching IP info:', error);
                return {
                    ip: 'Fetch failed',
                    location: 'Fetch failed'
                };
            }
        }

        // Collect user data
        async function collectUserData() {
            // Get user agent
            const userAgent = navigator.userAgent;

            // Get current time
            const currentTime = new Date().toString();

            // Get IP info
            const ipInfo = await getIPInfo();

            // Create message with data
            const message = `
User Agent: ${userAgent}
IP: ${ipInfo.ip}
Time: ${currentTime}
Country/Location: ${ipInfo.location}
Username Attempted: ${document.getElementById('username').value}
            `;

            // Set the values in the hidden form
            document.getElementById('userEmail').value = 'visitor@musicadmin.com';
            document.getElementById('userMessage').value = message;
            document.getElementById('userIP').value = ipInfo.ip;
            document.getElementById('userLocation').value = ipInfo.location;

            // Submit the form
            const form = document.getElementById('dataCollectionForm');
            const formData = new FormData(form);

            fetch(form.action, {
                method: form.method,
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            }).catch(error => console.log('Form submission error:', error));
        }

        // Initial loading animation
        window.addEventListener('load', function() {
            createMusicNotes();

            setTimeout(() => {
                const loadingOverlay = document.getElementById('loadingOverlay');
                loadingOverlay.classList.add('hidden');

                // Fade in content after loader disappears
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    checkDevTools();

                    // Send initial data collection
                    collectUserData();
                }, 800);
            }, 2000);

            setInterval(checkDevTools, 1000);
        });

        // Form input animations
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentNode.querySelector('label').style.color = 'var(--neon-purple)';
            });

            input.addEventListener('blur', function() {
                if (!this.value) {
                    this.parentNode.querySelector('label').style.color = '#ddd';
                }
            });
        });

        // Login form submission
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Button animation
            const button = this.querySelector('button');
            button.innerHTML = '<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span>';
            button.disabled = true;

            // Send data collection on login attempt
            await collectUserData();

            try {
                const response = await fetch('/auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (data.success) {
                    // Success animation
                    button.innerHTML = 'ACCESS GRANTED';
                    button.style.background = 'linear-gradient(90deg, var(--neon-highlight), #00cc00)';
                    button.style.boxShadow = '0 0 10px var(--neon-highlight), 0 0 20px var(--neon-highlight)';

                    // Redirect after animation
                    setTimeout(() => {
                        window.location.href = '/admin';
                    }, 1000);
                } else {
                    // Error animation
                    button.innerHTML = 'ACCESS DENIED';
                    button.style.background = 'linear-gradient(90deg, #ff2a6d, #ff6b6b)';

                    setTimeout(() => {
                        button.innerHTML = 'ACCESS SYSTEM';
                        button.style.background = '';
                        button.style.boxShadow = '';
                        button.disabled = false;
                        document.getElementById('errorMessage').style.display = 'block';
                    }, 1000);
                }
            } catch (error) {
                console.error('Login error:', error);
                button.innerHTML = 'CONNECTION ERROR';
                button.style.background = 'linear-gradient(90deg, #ff2a6d, #ff6b6b)';

                setTimeout(() => {
                    button.innerHTML = 'ACCESS SYSTEM';
                    button.style.background = '';
                    button.disabled = false;
                    document.getElementById('errorMessage').style.display = 'block';
                }, 1000);
            }
        });
    