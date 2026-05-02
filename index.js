require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!TOKEN || !USERNAME) {
  console.error("Missing ENV variables");
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "User-Agent": "smc-api"
};

// 🔹 GraphQL: Commits (Current Year)
async function getCommits() {
  const currentYear = new Date().getFullYear();
  const query = {
    query: `
    {
      user(login: "${USERNAME}") {
        contributionsCollection(from: "${currentYear}-01-01T00:00:00Z", to: "${currentYear}-12-31T23:59:59Z") {
          contributionCalendar {
            totalContributions
          }
        }
      }
    }`
  };

  const res = await axios.post(
    "https://api.github.com/graphql",
    query,
    { headers }
  );

  return res.data?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions || 0;
}


async function getRepos() {
  const res = await axios.get(
    `https://api.github.com/users/${USERNAME}/repos?per_page=100`,
    { headers }
  );
  return res.data || [];
}


async function getPRs() {
  const res = await axios.get(
    `https://api.github.com/search/issues?q=author:${USERNAME}+type:pr`,
    { headers }
  );

  return res.data?.total_count || 0;
}


async function getIssues() {
  const res = await axios.get(
    `https://api.github.com/search/issues?q=author:${USERNAME}+type:issue`,
    { headers }
  );

  return res.data?.total_count || 0;
}


app.get("/card", async (req, res) => {
  try {
    const repos = await getRepos();

    let stars = 0;
    let forks = 0;
    const orgs = new Set();

    repos.forEach(r => {
      stars += r.stargazers_count || 0;
      forks += r.forks_count || 0;

      if (r.owner?.login && r.owner.login !== USERNAME) {
        orgs.add(r.owner.login);
      }
    });

    const commits = await getCommits();
    const prs = await getPRs();
    const issues = await getIssues();
    const currentYear = new Date().getFullYear();

    const svg = `
    <svg width="520" height="230" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font: bold 20px sans-serif; fill: #58A6FF; }
        .text { font: 15px sans-serif; fill: #C9D1D9; }
        .bg { fill: #0D1117; }
      </style>

      <rect width="100%" height="100%" class="bg" rx="14"/>

      <text x="20" y="35" class="title">SMC GitHub Stats (${currentYear})</text>

      <text x="20" y="70" class="text">⭐ Stars: ${stars}</text>
      <text x="20" y="100" class="text">🔁 Commits (${currentYear}): ${commits}</text>
      <text x="20" y="130" class="text">🔀 PRs: ${prs}</text>
      <text x="20" y="160" class="text">🐛 Issues: ${issues}</text>
      <text x="20" y="190" class="text">🏢 Contributed to: ${orgs.size}</text>
    </svg>
    `;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.send(svg);

  } catch (err) {
    console.error(err.message);
    res.status(500).send("SMC API Error");
  }
});


app.get("/", (req, res) => {
  res.json({ status: "SMC API Running 🚀" });
});

app.get("/debug", (req, res) => {
  res.json({
    token: TOKEN ? "✅ Set" : "❌ Missing",
    username: USERNAME ? `✅ ${USERNAME}` : "❌ Missing",
    env: process.env.NODE_ENV
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SMC API running on ${PORT}`);
});