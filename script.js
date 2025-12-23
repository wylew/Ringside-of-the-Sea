const feedContainer = document.getElementById('blog-feed');
const fabBtn = document.getElementById('fab-add');
const dialog = document.getElementById('post-dialog');
const postForm = document.getElementById('post-form');
const postTypeSelect = document.getElementById('post-type');
const fieldsContainer = document.getElementById('fields-container');
const cancelBtn = document.getElementById('btn-cancel');

// We hold the full raw text of the file so we can append to it later
let rawMarkdownData = "";

// --- 1. Fetch & Parse Logic ---
async function initBlog() {
    try {
        const response = await fetch('posts.md');
        if (!response.ok) throw new Error('Failed to load posts.md');
        
        rawMarkdownData = await response.text();
        const posts = parseMarkdownFile(rawMarkdownData);
        renderPosts(posts);
    } catch (error) {
        console.warn("No posts.md found. Starting with empty blog.");
        rawMarkdownData = "";
    }
}

// Parses "---" separated blocks into Objects
function parseMarkdownFile(mdContent) {
    // Regex splits by lines containing ONLY "---"
    const chunks = mdContent.split(/^---$/gm).map(c => c.trim()).filter(c => c.length > 0);
    
    return chunks.map(chunk => {
        const lines = chunk.split('\n');
        const post = { type: 'text', content: '' };
        let isBody = false;
        let bodyLines = [];

        lines.forEach(line => {
            // Empty line indicates end of Headers and start of Body
            if (!isBody && line.trim() === '') {
                isBody = true;
                return;
            }

            if (!isBody) {
                // Parse Headers (Type: value)
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

// --- 2. Render Logic ---
function renderPosts(posts) {
    feedContainer.innerHTML = '';
    posts.forEach(post => {
        feedContainer.insertAdjacentHTML('beforeend', createCardHtml(post));
    });
}

function createCardHtml(post) {
    let contentHtml = '';
    const dateStr = post.date || '';

    // Use Marked.js to turn Markdown into HTML
    const bodyHtml = marked.parse(post.bodyRaw || '');

    switch(post.type.toLowerCase()) {
        case 'text':
            contentHtml = `
                <div class="card-padding">
                    <span class="timestamp">${dateStr}</span>
                    <h2 class="text-title">${post.title || 'Untitled'}</h2>
                    <div class="text-body">${bodyHtml}</div>
                </div>`;
            break;
        case 'image':
            // For images, bodyRaw is just the URL
            contentHtml = `
                <div class="card-image">
                    <img src="${post.bodyRaw}" alt="Post Image">
                </div>
                <div class="image-caption">
                    <span class="timestamp">${dateStr}</span>
                    ${post.caption || ''}
                </div>`;
            break;
        case 'conversation':
            const lines = post.bodyRaw.split('\n');
            const messagesHtml = lines.map((line, index) => {
                const sep = line.indexOf(':');
                if (sep === -1) return '';
                const speaker = line.substring(0, sep).trim();
                const text = line.substring(sep + 1).trim();
                const side = (index % 2 === 0) ? 'left' : 'right';
                return `<div class="chat-bubble-row ${side}">
                            <span class="speaker-name">${speaker}</span>
                            <div class="chat-bubble ${side}">${text}</div>
                        </div>`;
            }).join('');
            
            contentHtml = `
                <div class="card-padding">
                    <span class="timestamp">${dateStr}</span>
                    <div class="chat-container">${messagesHtml}</div>
                </div>`;
            break;
        case 'quote':
            contentHtml = `
                <div class="card-padding">
                    <span class="material-symbols-outlined quote-icon">format_quote</span>
                    <div class="quote-text">${post.bodyRaw}</div>
                    <div class="quote-author">— ${post.author || 'Unknown'}</div>
                </div>`;
            break;
    }
    const extraClass = post.type === 'quote' ? 'quote-container' : '';
    return `<article class="card ${extraClass}">${contentHtml}</article>`;
}

// --- 3. Form & File Generation Logic ---

fabBtn.addEventListener('click', () => { updateFormFields('text'); dialog.showModal(); });
cancelBtn.addEventListener('click', () => dialog.close());
postTypeSelect.addEventListener('change', (e) => updateFormFields(e.target.value));

function updateFormFields(type) {
    let html = '';
    if (type === 'text') {
        html = `<div class="input-group"><label>Title</label><input type="text" name="title" required></div>
                <div class="input-group"><label>Content (Markdown support)</label><textarea name="content" required></textarea></div>`;
    } else if (type === 'image') {
        html = `<div class="input-group"><label>Image URL</label><input type="url" name="imageUrl" required></div>
                <div class="input-group"><label>Caption</label><input type="text" name="caption" required></div>`;
    } else if (type === 'quote') {
        html = `<div class="input-group"><label>Quote Text</label><textarea name="text" required></textarea></div>
                <div class="input-group"><label>Author</label><input type="text" name="author" required></div>`;
    } else if (type === 'conversation') {
        html = `<div class="input-group"><label>Script</label><textarea name="rawConversation" placeholder="Name: Message" style="height:150px;" required></textarea></div>`;
    }
    fieldsContainer.innerHTML = html;
}

postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(postForm);
    const type = formData.get('type');
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Create the New Block in Markdown format
    let newBlock = `\n---\nType: ${type}\nDate: ${date}\n`;

    if (type === 'text') {
        newBlock += `Title: ${formData.get('title')}\n\n${formData.get('content')}`;
    } else if (type === 'image') {
        newBlock += `Caption: ${formData.get('caption')}\n\n${formData.get('imageUrl')}`;
    } else if (type === 'quote') {
        newBlock += `Author: ${formData.get('author')}\n\n${formData.get('text')}`;
    } else if (type === 'conversation') {
        newBlock += `\n${formData.get('rawConversation')}`;
    }

    // Combine New Block + Existing Data (Newest on Top)
    const updatedFileContent = newBlock + "\n" + rawMarkdownData;

    // Trigger Download
    const blob = new Blob([updatedFileContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'posts.md';
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    dialog.close();
    postForm.reset();
    
    // Refresh view
    rawMarkdownData = updatedFileContent;
    renderPosts(parseMarkdownFile(updatedFileContent));
});

document.addEventListener('DOMContentLoaded', initBlog);
