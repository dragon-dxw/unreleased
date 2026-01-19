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

    // Initial render
    renderRepos();
});

async function fetchRepoData(repoName) {
    const cardId = repoName.replace('/', '-');
    const releaseEl = document.getElementById(`release-${cardId}`);
    const countEl = document.getElementById(`count-${cardId}`);

    try {
        // 1. Fetch latest release
        const releaseRes = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`);

        if (releaseRes.status === 404) {
            releaseEl.textContent = 'No releases found';
            countEl.textContent = 'N/A';
            return;
        }

        if (!releaseRes.ok) throw new Error('Release fetch failed');

        const releaseData = await releaseRes.json();
        const publishedAt = releaseData.published_at;
        const tagName = releaseData.tag_name;

        const dateObj = new Date(publishedAt);
        releaseEl.innerHTML = `Since <a href="${releaseData.html_url}" target="_blank">${tagName}</a> (${dateObj.toLocaleDateString()})`;

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
        // We need to check if user.type === 'Bot'
        // searchData.items contains the PRs

        let nonBotCount = 0;
        let botCount = 0;

        // Note: Search API returns up to 100 items per page. 
        // For a dashboard, we might stop at 100 or need pagination if there are huge numbers.
        // For MVP, we'll verify the first page.

        for (const pr of searchData.items) {
            // Additional check to ensure it's not a bot
            // user.type is usually available in the search result item
            if (pr.user.type !== 'Bot' && !pr.user.login.endsWith('[bot]')) {
                nonBotCount++;
            } else {
                botCount++;
            }
        }

        // "Close-enough" search: repo specific, closed, unmerged, after date
        // Note: We can't easily filter "non-bot" in the search string generically, so this link might show bots.
        const webQuery = `is:pr is:closed is:unmerged closed:>${publishedAt}`;
        const webUrl = `https://github.com/${repoName}/pulls?q=${encodeURIComponent(webQuery)}`;

        countEl.innerHTML = `<a href="${webUrl}" target="_blank" style="color: inherit; text-decoration: underline;">${nonBotCount}</a>`;
        if (searchData.total_count > 100) {
            countEl.innerHTML += '+';
        }

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
