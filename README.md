# repofuse-user-finder

## RepoFuse Prospect Engine

Standalone product prototype for finding developers who are likely to value RepoFuse.

## What it does

- Searches public GitHub signals for developer prospects.
- Scores leads by repo count, recent activity, SaaS/AI keywords, public contact info, followers, Product Hunt signals, and build-in-public language.
- Shows an explainable prospect queue.
- Filters, sorts, and exports prospects as CSV.
- Generates a short personalized outreach draft.
- Requires human review before copying or marking a prospect contacted.
- Saves review status and private notes locally in the browser.

## What it does not do

- It does not send email.
- It does not auto-DM users.
- It does not write to a database.
- It does not require the main RepoFuse app.

Review status and notes are stored in browser localStorage so the app stays useful without adding auth or a database.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Optional live GitHub discovery

The app works with mock data by default. To enable live GitHub discovery:

```bash
cp .env.example .env.local
# add a GitHub token to .env.local
pnpm dev
```

The token is only used server-side.

## Main routes

- `/prospects` - prospect queue and product overview
- `/prospects/discover` - GitHub discovery filters
- `/prospects/[id]` - prospect details and manual outreach review

## Manual prospect workflow

1. Run discovery or use the sample queue.
2. Filter by score, status, or keyword.
3. Review a prospect detail page.
4. Save private notes and set a status.
5. Return to the queue and export a filtered CSV for your outreach workflow.

## Compliance stance

This is a lead finder plus human-approved review tool. It is intentionally not a spam bot. Use only public contact info and review every message before reaching out.
