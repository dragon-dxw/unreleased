const assert = require('assert');

// Mock Data
const releaseDate = "2024-01-01T00:00:00Z";
const prs = [
    {
        number: 1,
        title: "Valid PR",
        state: "closed",
        closed_at: "2024-01-02T00:00:00Z",
        user: { login: "user1", type: "User" }
    },
    {
        number: 2,
        title: "Bot PR",
        state: "closed",
        closed_at: "2024-01-02T00:00:00Z",
        user: { login: "dependabot[bot]", type: "Bot" }
    },
    {
        number: 3,
        title: "Old PR",
        state: "closed",
        closed_at: "2023-12-31T00:00:00Z",
        user: { login: "user2", type: "User" }
    },
    {
        number: 4,
        title: "Another Valid PR",
        state: "closed",
        closed_at: "2024-01-03T00:00:00Z",
        user: { login: "user3", type: "User" }
    },
    {
        number: 5,
        title: "Bot User Type PR",
        state: "closed",
        closed_at: "2024-01-03T00:00:00Z",
        user: { login: "some-bot", type: "Bot" }
    }
];

// Logic to test (duplicated from app.js)
function countUnmergedNonBotPRs(items, sinceDate) {
    let count = 0;
    const sinceTime = new Date(sinceDate).getTime();

    for (const pr of items) {
        const closedTime = new Date(pr.closed_at).getTime();

        // Date check (Though API does this, we double check)
        if (closedTime <= sinceTime) continue;

        // Bot check
        if (pr.user.type !== 'Bot' && !pr.user.login.endsWith('[bot]')) {
            count++;
        }
    }
    return count;
}

// Test
console.log("Running verification...");
try {
    const count = countUnmergedNonBotPRs(prs, releaseDate);
    console.log(`Expected: 2, Got: ${count}`);
    assert.strictEqual(count, 2, "Count should be 2");
    console.log("✅ Logic Verification Passed");
} catch (e) {
    console.error("❌ Verification Failed", e);
    process.exit(1);
}
