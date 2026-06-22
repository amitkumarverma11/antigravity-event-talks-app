// BigQuery Release Radar - JS Core Application

// Application State
let releaseNotes = [];
let filteredNotes = [];
let selectedUpdateId = null; // Stored as "entryIndex-updateIndex"
let activeCategory = 'all';
let searchQuery = '';
let lastFetchedTime = null;

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const refreshBtn = document.getElementById('refresh-btn');
const spinnerIcon = document.getElementById('spinner-icon');
const syncStatus = document.getElementById('sync-status');
const alertBanner = document.getElementById('alert-banner');
const timelineEvents = document.getElementById('timeline-events');
const filterChips = document.querySelectorAll('.filter-chip');
const tweetDrawer = document.getElementById('tweet-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const closeDrawerBtn = document.getElementById('close-drawer-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressRingCircle = document.querySelector('.progress-ring__circle');
const hashtagChips = document.querySelectorAll('.hashtag-chip');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');

// Count Badges Elements
const badgeAll = document.getElementById('count-all');
const badgeFeature = document.getElementById('count-feature');
const badgeAnnouncement = document.getElementById('count-announcement');
const badgeIssue = document.getElementById('count-issue');
const badgeDeprecation = document.getElementById('count-deprecation');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh action
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Search query processing
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderTimeline();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderTimeline();
    });

    // Filter categorization tabs
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.dataset.category;
            renderTimeline();
        });
    });

    // Drawer closure actions
    closeDrawerBtn.addEventListener('click', closeTweetDrawer);
    drawerBackdrop.addEventListener('click', closeTweetDrawer);

    // Dynamic Tweet counter updating
    tweetTextarea.addEventListener('input', updateCharCount);

    // Hashtags settings toggle
    hashtagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            regenerateTweetDraft();
        });
    });

    // Share action submission
    tweetSubmitBtn.addEventListener('click', handleTweetSubmit);

    // Alert banner dismissal
    alertBanner.querySelector('.alert-close').addEventListener('click', () => {
        alertBanner.style.display = 'none';
    });
}

// Fetch Releases from Flask API
async function fetchReleases(forceRefresh = false) {
    setLoadingState(true);
    alertBanner.style.display = 'none';

    try {
        const url = `/api/releases${forceRefresh ? '?force_refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned status code ${response.status}`);
        }
        
        const res = await response.json();
        
        if (res.warning) {
            showToast(res.warning, 'error');
            console.warn(res.warning);
        }

        // Extract feed entries
        releaseNotes = res.data.entries || [];
        lastFetchedTime = res.data.timestamp;

        // Render timeline & process count metrics
        renderTimeline();
        updateCategoryCountBadges();
        updateSyncStatus();
        
        showToast(forceRefresh ? "Feed refreshed successfully!" : "Feed loaded.", "success");

    } catch (error) {
        console.error("Fetch error:", error);
        showAlert(`Failed to fetch release notes: ${error.message}`);
        showToast("Error updating feed.", "error");
        
        // Render empty or cache placeholder if already have data
        if (releaseNotes.length === 0) {
            timelineEvents.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>Unable to Load Feed</h3>
                    <p>There was a connection issue loading the release notes feed. Please verify your connection and try refreshing.</p>
                </div>
            `;
        }
    } finally {
        setLoadingState(false);
    }
}

// Update loading ui attributes
function setLoadingState(isLoading) {
    if (isLoading) {
        spinnerIcon.classList.add('spin');
        refreshBtn.disabled = true;
        // Keep skeleton loader if this is first load
        if (releaseNotes.length === 0) {
            timelineEvents.innerHTML = `
                <div class="timeline-skeleton">
                    <div class="skeleton-group">
                        <div class="skeleton-date"></div>
                        <div class="skeleton-card"></div>
                        <div class="skeleton-card"></div>
                    </div>
                    <div class="skeleton-group">
                        <div class="skeleton-date"></div>
                        <div class="skeleton-card"></div>
                    </div>
                </div>
            `;
        }
    } else {
        spinnerIcon.classList.remove('spin');
        refreshBtn.disabled = false;
    }
}

// Update sync time status string
function updateSyncStatus() {
    if (!lastFetchedTime) return;
    const date = new Date(lastFetchedTime * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    syncStatus.textContent = `Last updated: ${timeStr}`;
}

// Show Warning alert banner
function showAlert(message) {
    alertBanner.querySelector('.alert-text').textContent = message;
    alertBanner.style.display = 'flex';
}

// Calculate badge category counts dynamically based on full fetched list
function updateCategoryCountBadges() {
    let allCount = 0;
    let counts = {
        'feature': 0,
        'announcement': 0,
        'issue': 0,
        'deprecation': 0
    };

    releaseNotes.forEach(entry => {
        entry.updates.forEach(update => {
            allCount++;
            const type = update.type.toLowerCase();
            if (counts.hasOwnProperty(type)) {
                counts[type]++;
            }
        });
    });

    badgeAll.textContent = allCount;
    badgeFeature.textContent = counts['feature'];
    badgeAnnouncement.textContent = counts['announcement'];
    badgeIssue.textContent = counts['issue'];
    badgeDeprecation.textContent = counts['deprecation'];
}

// Render Timeline Content
function renderTimeline() {
    timelineEvents.innerHTML = '';
    
    // Group notes and filter
    const groupedData = [];

    releaseNotes.forEach((entry, entryIndex) => {
        const matchingUpdates = [];
        
        entry.updates.forEach((update, updateIndex) => {
            const id = `${entryIndex}-${updateIndex}`;
            const type = update.type.toLowerCase();
            const textMatch = update.text.toLowerCase().includes(searchQuery) || entry.title.toLowerCase().includes(searchQuery);
            
            // Check Category filter
            const categoryMatch = (activeCategory === 'all') || (type === activeCategory);
            
            if (categoryMatch && textMatch) {
                matchingUpdates.push({
                    id: id,
                    type: update.type,
                    html: update.html,
                    text: update.text
                });
            }
        });

        if (matchingUpdates.length > 0) {
            groupedData.push({
                title: entry.title,
                link: entry.link,
                updates: matchingUpdates
            });
        }
    });

    // Check empty state
    if (groupedData.length === 0) {
        timelineEvents.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass-minus"></i>
                <h3>No updates found</h3>
                <p>Try refining your search terms or checking a different category.</p>
            </div>
        `;
        return;
    }

    // Build timeline DOM
    groupedData.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        const nodeEl = document.createElement('div');
        nodeEl.className = 'timeline-node';
        groupEl.appendChild(nodeEl);

        const dateEl = document.createElement('div');
        dateEl.className = 'timeline-date';
        dateEl.textContent = group.title;
        groupEl.appendChild(dateEl);

        const cardsEl = document.createElement('div');
        cardsEl.className = 'timeline-cards';

        group.updates.forEach(update => {
            const cardEl = document.createElement('div');
            cardEl.className = `release-card ${selectedUpdateId === update.id ? 'selected' : ''}`;
            cardEl.dataset.id = update.id;
            cardEl.dataset.text = update.text;
            cardEl.dataset.date = group.title;
            cardEl.dataset.link = group.link;

            const badgeClass = `badge-${update.type.toLowerCase()}`;
            
            cardEl.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${update.type}</span>
                    <div class="card-actions">
                        <div class="select-indicator"><i class="fa-solid fa-check"></i></div>
                    </div>
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
                <div class="card-footer">
                    <button class="btn-card-tweet" title="Format Tweet for this Update">
                        <i class="fa-brands fa-x-twitter"></i>
                        <span>Tweet Update</span>
                    </button>
                </div>
            `;

            // Click on card selects/deselects it
            cardEl.addEventListener('click', (e) => {
                // Avoid selection toggle if user specifically clicked a link
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }

                // If user clicked the tweet button inside card, load and open drawer directly
                const tweetButton = e.target.closest('.btn-card-tweet');
                if (tweetButton) {
                    e.stopPropagation();
                    selectCard(update.id, true);
                    return;
                }
                
                toggleCardSelection(update.id);
            });

            cardsEl.appendChild(cardEl);
        });

        groupEl.appendChild(cardsEl);
        timelineEvents.appendChild(groupEl);
    });
}

// Selection triggers
function toggleCardSelection(id) {
    if (selectedUpdateId === id) {
        deselectCard();
    } else {
        selectCard(id);
    }
}

function selectCard(id, forceOpenDrawer = false) {
    selectedUpdateId = id;
    
    // Update card styling classes
    document.querySelectorAll('.release-card').forEach(card => {
        if (card.dataset.id === id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    // Populate tweet content
    regenerateTweetDraft();
    
    // Slide drawer open
    openTweetDrawer();
}

function deselectCard() {
    selectedUpdateId = null;
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
    });
    closeTweetDrawer();
}

// Drawer visibility operations
function openTweetDrawer() {
    tweetDrawer.classList.add('open');
    drawerBackdrop.classList.add('active');
}

function closeTweetDrawer() {
    tweetDrawer.classList.remove('open');
    drawerBackdrop.classList.remove('active');
    // We don't necessarily deselect card instantly on drawer close so user can see what was clicked,
    // but standard behavior is to reset if they click the background.
}

// Re-generate tweet draft based on active cards and selected hashtags
function regenerateTweetDraft() {
    if (!selectedUpdateId) return;

    const selectedCard = document.querySelector(`.release-card[data-id="${selectedUpdateId}"]`);
    if (!selectedCard) return;

    const updateText = selectedCard.dataset.text;
    const dateStr = selectedCard.dataset.date;
    const link = selectedCard.dataset.link;
    const type = selectedCard.querySelector('.badge').textContent;

    // Get active hashtag list
    const activeHashtags = [];
    hashtagChips.forEach(chip => {
        if (chip.classList.contains('active')) {
            activeHashtags.push(chip.dataset.hashtag);
        }
    });

    // Structure a clean tweet text
    const emojiMap = {
        'Feature': '🚀',
        'Announcement': '📢',
        'Issue': '⚠️',
        'Deprecation': '🛑',
        'General': '⚡'
    };
    const emoji = emojiMap[type] || '⚡';

    const header = `${emoji} BigQuery ${type} (${dateStr}):\n\n`;
    const linkSection = link ? `\n\nLink: ${link}` : '';
    const tagsSection = activeHashtags.length > 0 ? `\n\n${activeHashtags.join(' ')}` : '';
    
    // Max characters count calculation (standard tweet is 280)
    const baseLength = header.length + linkSection.length + tagsSection.length;
    const allowedLength = 280 - baseLength;

    let cleanText = updateText;
    
    // Clean trailing punctuation or details if we truncate
    if (cleanText.length > allowedLength) {
        cleanText = cleanText.substring(0, allowedLength - 3).trim() + '...';
    }

    tweetTextarea.value = `${header}${cleanText}${linkSection}${tagsSection}`;
    updateCharCount();
}

// Characters Count progress metrics
function updateCharCount() {
    const textLength = tweetTextarea.value.length;
    const remaining = 280 - textLength;
    
    charCounter.textContent = remaining;

    // Warning and error statuses styling
    if (remaining < 0) {
        charCounter.className = 'char-counter error';
        progressRingCircle.style.stroke = '#ec4899';
    } else if (remaining <= 20) {
        charCounter.className = 'char-counter warning';
        progressRingCircle.style.stroke = '#f59e0b';
    } else {
        charCounter.className = 'char-counter';
        progressRingCircle.style.stroke = '#3b82f6';
    }

    // Update circular SVG path offset
    const radius = 10;
    const circumference = 2 * Math.PI * radius; // ~62.83
    
    // Percentage filled
    const percentage = Math.min(textLength / 280, 1);
    const offset = circumference - (percentage * circumference);
    
    progressRingCircle.style.strokeDashoffset = offset;
}

// Tweet submission open Web intent
function handleTweetSubmit() {
    const tweetText = tweetTextarea.value;
    
    if (tweetText.length > 280) {
        showToast("Tweet exceeds the 280 characters limit!", "error");
        return;
    }
    
    if (tweetText.trim().length === 0) {
        showToast("Tweet body cannot be empty.", "error");
        return;
    }

    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank');
    showToast("Opening X/Twitter...", "success");
}

// Toast Helpers
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Fade out after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// Add animation rule dynamically for toast out
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes toastOut {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-20px); opacity: 0; }
}
`;
document.head.appendChild(styleSheet);
