const sessionList = document.getElementById('session-list');
const sessionContent = document.getElementById('session-content');
const fabBtn = document.getElementById('fab-add');
const dialog = document.getElementById('post-dialog');
const postForm = document.getElementById('post-form');
const postTypeSelect = document.getElementById('post-type');
const fieldsContainer = document.getElementById('fields-container');
const cancelBtn = document.getElementById('btn-cancel');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');

let sessions = {};
let currentSessionNumber = null;

// --- HELPER FUNCTIONS ---

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date = new Date()) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function showSuccess(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-toast';
    successMsg.textContent = message;
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
}

function showError(message) {
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-toast';
    errorMsg.textContent = message;
    document.body.appendChild(errorMsg);
    setTimeout(() => errorMsg.remove(), 4000);
}

// --- PARSE POSTS ---

function parseMarkdownFile(mdContent) {
    if (!mdContent || mdContent.trim() === '') {
        return [];
    }
    
    const chunks = mdContent
        .split(/\r?\n---\r?\n/)
        .map(c => c.trim())
        .filter(c => c.length > 0);
    
    return chunks.map(chunk => {
        const lines = chunk.split(/\r?\n/);
        const post = { type: 'text', content: '' };
        let isBody = false;
        let bodyLines = [];

        lines.forEach(line => {
            if (!isBody && line.trim() === '') {
                isBody = true;
                return;
            }

            if (!isBody) {
                const match = line.match(/^([a-zA-Z]+):\s*(.*)$/);
                if (match) {
                    post[match[1].toLowerCase()] = match[2].trim();
                }
            } else {
                bodyLines.push(line);
            }
        });

        post.bodyRaw = bodyLines.join('\n').trim();
        return post;
    });
}

function organizeSessionPosts(sessionNumber, posts) {
    return {
        number: sessionNumber,
        date: posts.length > 0 ? posts[0].date : formatDate(),
        posts: posts
    };
}

// --- LOAD SESSIONS ---

async function loadAllSessions() {
    sessions = {};
    
    try {
        // Try to load local session files (session-1.md through session-20.md)
        for (let i = 1; i <= 20; i++) {
            try {
                const response = await fetch(`sessions/session-${i}.md`);
                if (response.ok) {
                    const content = await response.text();
                    const posts = parseMarkdownFile(content);
                    sessions[i] = organizeSessionPosts(i, posts);
                }
            } catch (error) {
                // File doesn't exist, skip
            }
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

// --- RENDER FUNCTIONS ---

function renderSessionList() {
    const sortedSessions = Object.keys(sessions)
        .sort((a, b) => parseInt(b) - parseInt(a));
    
    if (sortedSessions.length === 0) {
        sessionList.innerHTML = '<div class="loading-sessions">No sessions found. Create your first post!</div>';
        return;
    }
    
    sessionList.innerHTML = sortedSessions.map(sessionNum => {
        const session = sessions[sessionNum];
        const postCount = session.posts.length;
        const recapCount = session.posts.filter(p => p.type === 'recap').length;
        
        return `
            <div class="session-item" data-session="${sessionNum}">
                <div class="session-item-number">Session ${sessionNum}</div>
                <div class="session-item-date">${session.date}</div>
                <div class="session-item-count">${postCount} ${postCount === 1 ? 'entry' : 'entries'}${recapCount > 0 ? ` • ${recapCount} recap` : ''}</div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
            const sessionNum = item.dataset.session;
            displaySession(sessionNum);
        });
    });
}

function displaySession(sessionNum) {
    currentSessionNumber = sessionNum;
    const session = sessions[sessionNum];
    
    if (!session) return;
    
    // Update active state
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.toggle('active', item.dataset.session === sessionNum);
    });
    
    // Separate recap and other posts
    const recapPosts = session.posts.filter(p => p.type === 'recap');
    const otherPosts = session.posts.filter(p => p.type !== 'recap');
    
    let html = `
        <div class="session-header">
            <h1 class="session-header-title">Session ${sessionNum}</h1>
            <div class="session-header-date">${session.date}</div>
        </div>
    `;
    
    // Render recap first
    recapPosts.forEach(post => {
        html += createPostCardHtml(post, true);
    });
    
    // Render other posts
    otherPosts.forEach(post => {
        html += createPostCardHtml(post, false);
    });
    
    sessionContent.innerHTML = html;
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
    
    // Scroll to top
    document.querySelector('.content-area').scrollTop = 0;
}

function createPostCardHtml(post, isRecap) {
    const bodyHtml = marked.parse(post.bodyRaw || '');
    let contentHtml = '';
    let extraClass = isRecap ? 'recap-card' : '';
    
    switch(post.type.toLowerCase()) {
        case 'recap':
        case 'text':
            extraClass += post.type === 'recap' ? ' recap-card' : '';
            contentHtml = `
                <div class="card-padding">
                    ${post.type === 'recap' ? '<span class="post-type-label">Session Recap</span>' : ''}
                    <h2 class="text-title">${escapeHtml(post.title || 'Untitled')}</h2>
                    <div class="text-body">${bodyHtml}</div>
                </div>`;
            break;
            
        case 'conversation':
            const lines = post.bodyRaw.split('\n').filter(line => line.trim());
            const messagesHtml = lines.map((line, index) => {
                const sep = line.indexOf(':');
                if (sep === -1) return '';
                
                const speaker = line.substring(0, sep).trim();
                const text = line.substring(sep + 1).trim();
                
                if (!speaker || !text) return '';
                
                const side = (index % 2 === 0) ? 'left' : 'right';
                return `<div class="chat-bubble-row ${side}">
                            <span class="speaker-name">${escapeHtml(speaker)}</span>
                            <div class="chat-bubble ${side}">${escapeHtml(text)}</div>
                        </div>`;
            }).filter(html => html).join('');
            
            contentHtml = `
                <div class="card-padding">
                    <span class="post-type-label">Conversation</span>
                    <div class="chat-container">${messagesHtml}</div>
                </div>`;
            break;
            
        case 'quote':
            extraClass += ' quote-card';
            contentHtml = `
                <div class="card-padding">
                    <span class="post-type-label">Quote</span>
                    <div class="quote-text">"${escapeHtml(post.bodyRaw)}"</div>
                    <div class="quote-author">— ${escapeHtml(post.author || 'Unknown')}</div>
                </div>`;
            break;
    }
    
    return `<article class="post-card ${extraClass}">${contentHtml}</article>`;
}

// --- INITIALIZATION ---

async function initDiary() {
    sessionList.innerHTML = '<div class="loading-sessions">Loading sessions...</div>';
    
    await loadAllSessions();
    renderSessionList();
    
    // Auto-select first session
    const sortedSessions = Object.keys(sessions)
        .sort((a, b) => parseInt(b) - parseInt(a));
    
    if (sortedSessions.length > 0) {
        displaySession(sortedSessions[0]);
    } else {
        sessionContent.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to Ringside of the Sea</h2>
                <p>No sessions found. Click the + button to create your first session!</p>
                <p style="font-size: 14px; opacity: 0.8; margin-top: 24px;">
                    Sessions are stored in separate markdown files in the <code>sessions/</code> folder.
                </p>
            </div>
        `;
    }
}

// --- NEW POST FORM ---

fabBtn.addEventListener('click', () => {
    updateFormFields('recap');
    dialog.showModal();
});

cancelBtn.addEventListener('click', () => {
    dialog.close();
    postForm.reset();
});

postTypeSelect.addEventListener('change', (e) => updateFormFields(e.target.value));

function updateFormFields(type) {
    let html = `<div class="input-group">
                    <label>Session Number</label>
                    <input type="number" name="session" placeholder="1" min="1" required>
                    <small>Which session is this for?</small>
                </div>`;
    
    if (type === 'recap' || type === 'text') {
        html += `<div class="input-group">
                    <label>Title</label>
                    <input type="text" name="title" required>
                </div>
                <div class="input-group">
                    <label>Content (Markdown supported)</label>
                    <textarea name="content" rows="8" required></textarea>
                </div>`;
    } else if (type === 'quote') {
        html += `<div class="input-group">
                    <label>Quote Text</label>
                    <textarea name="text" rows="4" required></textarea>
                </div>
                <div class="input-group">
                    <label>Author</label>
                    <input type="text" name="author" required>
                </div>`;
    } else if (type === 'conversation') {
        html += `<div class="input-group">
                    <label>Conversation Script</label>
                    <textarea name="rawConversation" rows="8" placeholder="Alice: Hello!
Bob: Hi there!" required></textarea>
                    <small>Format: Name: Message (one per line)</small>
                </div>`;
    }
    
    fieldsContainer.innerHTML = html;
}

postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(postForm);
    const type = formData.get('type');
    const sessionNum = formData.get('session')?.trim();
    const date = formatDate();
    
    if (!sessionNum) {
        showError('Session number is required');
        return;
    }
    
    dialog.close();
    postForm.reset();

    try {
        // Load existing session file
        let existingContent = '';
        try {
            const response = await fetch(`sessions/session-${sessionNum}.md`);
            if (response.ok) {
                existingContent = await response.text();
            }
        } catch (error) {
            // New session file
            console.log(`Creating new session file for session ${sessionNum}`);
        }
        
        // Create new post block
        let newBlock = `Type: ${type}\nDate: ${date}\n`;

        if (type === 'recap' || type === 'text') {
            newBlock += `Title: ${formData.get('title')}\n\n${formData.get('content')}`;
        } else if (type === 'quote') {
            newBlock += `Author: ${formData.get('author')}\n\n${formData.get('text')}`;
        } else if (type === 'conversation') {
            newBlock += `\n${formData.get('rawConversation')}`;
        }

        // Append to existing content
        const updatedContent = existingContent.trim() 
            ? newBlock + "\n---\n" + existingContent 
            : newBlock;

        // Download the session file
        const blob = new Blob([updatedContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `session-${sessionNum}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess(`Session ${sessionNum} file downloaded! Upload to sessions/ folder and refresh.`);
        
    } catch (error) {
        console.error('Error creating post:', error);
        showError(`Failed to create post: ${error.message}`);
        dialog.showModal();
    }
});

// --- MOBILE SIDEBAR TOGGLE ---

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// --- KEYBOARD SHORTCUTS ---

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (dialog.open) {
            dialog.close();
            postForm.reset();
        }
        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        updateFormFields('recap');
        dialog.showModal();
    }
});

// --- INITIALIZE ---

document.addEventListener('DOMContentLoaded', initDiary);
