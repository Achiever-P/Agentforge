# 🚀 Deploy AgentForge to Railway (Free)

## Step 1 — Push to GitHub

1. Go to github.com → click **New repository**
2. Name it `agentforge` → click **Create repository**
3. On your computer, open a terminal in this folder and run:

```
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/agentforge.git
git push -u origin main
```

> ⚠️ The .env file is gitignored — your API key will NOT be pushed to GitHub.

---

## Step 2 — Deploy on Railway

1. Go to **railway.app** and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `agentforge` repo
4. Railway auto-detects Node.js and deploys it

---

## Step 3 — Add your API Key on Railway

1. In your Railway project, click the service → **Variables** tab
2. Click **New Variable**
3. Add:
   - Key: `GEMINI_API_KEY`
   - Value: your Google AI Studio key
4. Railway restarts automatically

---

## Step 4 — Get your live URL

1. Click the **Settings** tab in Railway
2. Under **Networking** → click **Generate Domain**
3. Your app is live at something like: `agentforge-production.up.railway.app`

---

## That's it! 🎉

Your app is now live, HTTPS, and publicly accessible.
The API key stays secret inside Railway's environment — never in the code.
