document.addEventListener('DOMContentLoaded', () => {
    const repoInput = document.getElementById('repoInput');
    const addRepoBtn = document.getElementById('addRepoBtn');
    const repoGrid = document.getElementById('repoGrid');

    // Load repos from localStorage
    let repos = JSON.parse(localStorage.getItem('dashboardRepos')) || [];

    const saveRepos = () => {
        localStorage.setItem('dashboardRepos', JSON.stringify(repos));
    };

    const renderRepos = () => {
        repoGrid.innerHTML = '';
        repos.forEach(repo => {
            const card = createRepoCard(repo);
            repoGrid.appendChild(card);
            // Here we would trigger the data fetch for this repo
            fetchRepoData(repo);
        });
    };

    const createRepoCard = (repoName) => {
        const div = document.createElement('div');
        div.className = 'repo-card';
        div.id = `card-${repoName.replace('/', '-')}`;
        div.innerHTML = `
            <div class="repo-header">
                <a href="https://github.com/${repoName}" target="_blank" class="repo-name">${repoName}</a>
                <button class="delete-btn" onclick="removeRepo('${repoName}')">×</button>
            </div>
            <div class="release-info" id="release-${repoName.replace('/', '-')}">Loading release info...</div>
            <div class="stat-group">
                <div class="stat-label">Unmerged Non-Bot Closed PRs</div>
                <div class="stat-value" id="count-${repoName.replace('/', '-')}">-</div>
                <div id="pr-list-${repoName.replace('/', '-')}" class="pr-list-container"></div>
            </div>
        `;
        return div;
    };

    const addRepo = () => {
        const repoName = repoInput.value.trim();
        if (repoName && !repos.includes(repoName)) {
            // Basic validation for owner/repo format
            if (!repoName.includes('/')) {
                alert('Please use the format: owner/repo');
                return;
            }
            repos.push(repoName);
            saveRepos();
            renderRepos();
            repoInput.value = '';
        }
    };

    window.removeRepo = (repoName) => {
        repos = repos.filter(r => r !== repoName);
        saveRepos();
        renderRepos();
    };

    addRepoBtn.addEventListener('click', addRepo);
    repoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addRepo();
    });

    const refreshBtn = document.getElementById('refreshBtn');

    refreshBtn.addEventListener('click', () => {
        console.log('Refreshing all...');
        repos.forEach(repo => fetchRepoData(repo, true));
    });

    // Initial render
    renderRepos();
});

async function fetchRepoData(repoName, forceRefresh = false) {
    const cardId = repoName.replace('/', '-');
    const releaseEl = document.getElementById(`release-${cardId}`);
    const countEl = document.getElementById(`count-${cardId}`);
    const CACHE_KEY = `cache-${repoName}`;
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

    // 0. Check Cache (skip if forceRefresh is true)
    if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log(`Using cached data for ${repoName}`);
                    updateCard(repoName, data.releaseHtml, data.countHtml, data.prs);
                    return;
                }
            } catch (e) {
                console.warn('Cache parse error', e);
            }
        }
    } else {
        console.log(`Force refreshing ${repoName}...`);
        if (releaseEl) releaseEl.textContent = 'Refreshing...';
        if (countEl) countEl.textContent = '-';
    }

    try {
        // 1. Fetch latest release
        const releaseRes = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);

        if (releaseRes.status === 404) {
            const noReleaseHtml = 'No releases found';
            const noCountHtml = 'N/A';
            updateCard(repoName, noReleaseHtml, noCountHtml);
            // Cache "no data" states as well to allow cooling off
            saveToCache(CACHE_KEY, { releaseHtml: noReleaseHtml, countHtml: noCountHtml });
            return;
        }

        if (!releaseRes.ok) throw new Error('Release fetch failed');

        const releaseData = await releaseRes.json();
        const publishedAt = releaseData.published_at;
        const tagName = releaseData.tag_name;

        const dateObj = new Date(publishedAt);
        const releaseHtml = `Since <a href="${releaseData.html_url}" target="_blank">${tagName}</a> (${dateObj.toLocaleDateString()})`;

        // 2. Search for PRs
        // Query: repo:owner/name is:pr is:closed is:unmerged closed:>YYYY-MM-DDTHH:MM:SSZ
        const q = `repo:${repoName} is:pr is:closed is:unmerged closed:>${publishedAt}`;
        const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=100`;

        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}));
            throw new Error(`Search failed: ${errData.message || searchRes.statusText}`);
        }

        const searchData = await searchRes.json();

        // 3. Filter out bots
        let nonBotCount = 0;
        const relevantPRs = [];

        for (const pr of searchData.items) {
            if (pr.user.type !== 'Bot' && !pr.user.login.endsWith('[bot]')) {
                nonBotCount++;
                relevantPRs.push({
                    title: pr.title,
                    url: pr.html_url,
                    user: pr.user.login,
                    number: pr.number
                });
            }
        }

        // 4. Prepare display HTML
        let countHtml = nonBotCount;

        // "Close-enough" search: repo specific, closed, unmerged, after date
        // Note: We can't easily filter "non-bot" in the search string generically, so this link might show bots.
        const webQuery = `is:pr is:closed is:unmerged closed:>${publishedAt}`;
        const webUrl = `https://github.com/${repoName}/pulls?q=${encodeURIComponent(webQuery)}`;

        countHtml = `<a href="${webUrl}" target="_blank" style="color: inherit; text-decoration: underline;">${nonBotCount}</a>`;
        if (searchData.total_count > 100) {
            countHtml += '+';
        }

        updateCard(repoName, releaseHtml, countHtml, relevantPRs);
        saveToCache(CACHE_KEY, { releaseHtml, countHtml, prs: relevantPRs });

    } catch (err) {
        console.error(err);
        releaseEl.textContent = `Error: ${err.message}`;
        countEl.textContent = '-';

        // Check for rate limit
        if (err.message.toLocaleLowerCase().includes('rate limit') || err.message.includes('403')) {
            releaseEl.textContent = 'Error: Rate limit exceeded (60/hr). Try again later.';
        }
    }
}

function updateCard(repoName, releaseHtml, countHtml, prs = []) {
    const cardId = repoName.replace('/', '-');
    const releaseEl = document.getElementById(`release-${cardId}`);
    const countEl = document.getElementById(`count-${cardId}`);
    const prListEl = document.getElementById(`pr-list-${cardId}`);

    if (releaseEl) releaseEl.innerHTML = releaseHtml;
    if (countEl) countEl.innerHTML = countHtml;

    if (prListEl) {
        if (prs && prs.length > 0) {
            const listItems = prs.map(pr => `
                <li class="pr-item">
                    <a href="${pr.url}" target="_blank" class="pr-link">
                        ${pr.title} #${pr.number}
                        <br>
                        <span class="pr-user">by ${pr.user}</span>
                    </a>
                </li>
            `).join('');

            prListEl.innerHTML = `
                <details class="pr-details">
                    <summary>View ${prs.length} PRs</summary>
                    <ul class="pr-list">
                        ${listItems}
                    </ul>
                </details>
            `;
        } else {
            prListEl.innerHTML = '';
        }
    }
}

function saveToCache(key, data) {
    localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data
    }));
}
