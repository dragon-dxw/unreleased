# GitHub Release Tracker

A simple dashboard to track unmerged, non-bot closed Pull Requests for GitHub repositories since their last release.

## Features
- **Track Repos**: Add any public GitHub repository (e.g., `facebook/react`).
- **Smart Counting**: Counts PRs that are `closed`, `unmerged`, and created *after* the latest release tag.
- **Bot Filtering**: Excludes PRs from users with `type: Bot` or names ending in `[bot]`.
- **Direct Links**: Click the count to view the matching PRs on GitHub.
- **Local Storage**: Your repo list is saved in your browser.

## How to Run Locally
1.  Clone the repository.
2.  Open `index.html` in your browser.

## Deploying to GitHub Pages
This project is a static site and is perfect for **GitHub Pages**.

1.  Push this repository to GitHub.
2.  Go to the repository **Settings**.
3.  Navigate to the **Pages** section (sidebar).
4.  Under **Build and deployment > Branch**, select `main` (or your default branch) and the `/ (root)` folder.
5.  Click **Save**.
6.  Your dashboard will be live at `https://<username>.github.io/<repo-name>/`.
