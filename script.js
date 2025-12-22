const feedContainer = document.getElementById('blog-feed');
const fabBtn = document.getElementById('fab-add');
const dialog = document.getElementById('post-dialog');
const postForm = document.getElementById('post-form');
const postTypeSelect = document.getElementById('post-type');
const fieldsContainer = document.getElementById('fields-container');
const cancelBtn = document.getElementById('btn-cancel');

// Store posts in memory
let currentPosts = [];

// --- 1. Initialize ---
async function initBlog() {
    try {
        const response = await fetch('posts.json');
        if (!response.ok) throw new Error('Failed to load posts.json');
        currentPosts = await response.json();
        renderPosts(currentPosts);
    } catch (error) {
        console.warn("No posts.json found. Starting with empty blog.");
        currentPosts = [];
    }
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
    const dateStr = post.date || new Date().toLocaleDateString();

    switch(post.type) {
        case 'text':
            contentHtml = `
                <div class="card-padding">
                    <span class="timestamp">${dateStr}</span>
                    <h2 class="text-title">${post.title}</h2>
                    <p class="text-body">${post.content}</p>
                </div>`;
            break;
        case 'image':
            contentHtml = `
                <div class="card-image">
                    <img src="${post.imageUrl}" alt="Post Image">
                </div>
                <div class="image-caption">
                    <span class="timestamp">${dateStr}</span>
                    ${post.caption}
                </div>`;
            break;
        case 'conversation':
            const msgs = post.messages || [];
            const messagesHtml = msgs.map(msg => `
                <div class="chat-bubble-row ${msg.side}">
                    <span class="speaker-name">${msg.speaker}</span>
                    <div class="chat-bubble ${msg.side}">${msg.text}</div>
                </div>`).join('');
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
                    <div class="quote-text">${post.text}</div>
                    <div class="quote-author">— ${post.author}</div>
                </div>`;
            break;
    }
    const extraClass = post.type === 'quote' ? 'quote-container' : '';
    return `<article class="card ${extraClass}">${contentHtml}</article>`;
}

// --- 3. Form & Download Logic ---

// Open Dialog
fabBtn.addEventListener('click', () => {
    updateFormFields('text'); // Default to text
    dialog.showModal();
});

// Close Dialog
cancelBtn.addEventListener('click', () => dialog.close());

// Switch Fields
postTypeSelect.addEventListener('change', (e) => updateFormFields(e.target.value));

function updateFormFields(type) {
    let html = '';
    if (type === 'text') {
        html = `<div class="input-group"><label>Title</label><input type="text" name="title" required></div>
                <div class="input-group"><label>Content</label><textarea name="content" required></textarea></div>`;
    } else if (type === 'image') {
        html = `<div class="input-group"><label>Image URL</label><input type="url" name="imageUrl" required></div>
                <div class="input-group"><label>Caption</label><input type="text" name="caption" required></div>`;
    } else if (type === 'quote') {
        html = `<div class="input-group"><label>Quote Text</label><textarea name="text" required></textarea></div>
                <div class="input-group"><label>Author</label><input type="text" name="author" required></div>`;
    } else if (type === 'conversation') {
        html = `<div class="input-group"><label>Script</label>
                <textarea name="rawConversation" placeholder="Name: Message" style="height:150px;" required></textarea>
                <div style="font-size:11px; margin-top:4px;">Format: "Name: Message" (new line for each)</div></div>`;
    }
    fieldsContainer.innerHTML = html;
}

// Handle "Download Update"
postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(postForm);
    const type = formData.get('type');
    
    const newPost = {
        id: Date.now(),
        type: type,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    if (type === 'text') {
        newPost.title = formData.get('title');
        newPost.content = formData.get('content');
    } else if (type === 'image') {
        newPost.imageUrl = formData.get('imageUrl');
        newPost.caption = formData.get('caption');
    } else if (type === 'quote') {
        newPost.text = formData.get('text');
        newPost.author = formData.get('author');
    } else if (type === 'conversation') {
        const lines = formData.get('rawConversation').split('\n');
        newPost.messages = lines.map((line, index) => {
            const sep = line.indexOf(':');
            if (sep === -1) return null;
            return { 
                speaker: line.substring(0, sep).trim(), 
                text: line.substring(sep + 1).trim(), 
                side: (index % 2 === 0) ? 'left' : 'right' 
            };
        }).filter(Boolean);
    }

    // Add to top of list
    currentPosts.unshift(newPost);

    // Trigger Download
    const jsonStr = JSON.stringify(currentPosts, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'posts.json';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    dialog.close();
    postForm.reset();
});

document.addEventListener('DOMContentLoaded', initBlog);