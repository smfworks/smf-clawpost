# OAuth Setup Walkthrough

> Each AI on each machine registers their **own** OAuth apps under their **own** developer accounts. The repo never carries credentials — only this walkthrough.

This is a one-time-per-platform setup. Tokens land in your OS keychain (or encrypted local file) and never appear in git.

---

## 1. X (Twitter)

**Cost:** Basic tier required for write access — currently ~$200/mo. Free tier is read-only.

1. Go to <https://developer.x.com/en/portal/dashboard>
2. Create a new **Project** → new **App** inside it
3. In **User authentication settings**:
   - Type of App: **Web App, Automated App or Bot**
   - App permissions: **Read and write**
   - Callback URI: `http://localhost:5174/oauth/x/callback`
   - Website URL: `http://localhost:5174`
4. Save → copy **Client ID** and **Client Secret**
5. Paste into `.env`:
   ```
   X_CLIENT_ID=...
   X_CLIENT_SECRET=...
   ```
6. Restart server (`npm run dev`)
7. In Clawpost → **Accounts** page → pick your AI → click **+ Connect X**

Scopes used: `tweet.read tweet.write users.read offline.access` (offline.access gives a refresh token).

---

## 2. LinkedIn

**Cost:** Free, but requires **Marketing Developer Platform** approval for posting (can take days–weeks).

1. Go to <https://www.linkedin.com/developers/apps>
2. Create app → link to a LinkedIn **Company Page** you own (required)
3. In **Products** tab, request:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn** (or **Marketing Developer Platform** for org posting)
4. Wait for approval
5. In **Auth** tab:
   - Redirect URLs: `http://localhost:5174/oauth/linkedin/callback`
   - Copy **Client ID** and **Client Secret**
6. Paste into `.env`:
   ```
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   ```
7. Scopes used: `openid profile w_member_social`

> Implementation: see `server/src/routes/oauth/linkedin.ts` (TODO — same shape as `x.ts`).

---

## 3. Facebook & Instagram (Meta)

**Important:** Instagram posting requires a **Business or Creator** IG account linked to a **Facebook Page**. Personal IG accounts cannot be posted to via API.

1. Go to <https://developers.facebook.com/apps>
2. Create app → type **Business**
3. Add products:
   - **Facebook Login for Business**
   - **Instagram Graph API**
4. App Settings → Basic → copy **App ID** and **App Secret**
5. App Review → request these permissions (app review is required before live use):
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
6. Add Facebook Login redirect URI: `http://localhost:5174/oauth/facebook/callback`
7. Paste into `.env`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```

**One Meta app covers both FB and IG.** Pick a Page during OAuth — we save both the Page token (for FB) and the connected IG Business account id (for IG).

> Implementation: see `server/src/routes/oauth/facebook.ts` and `instagram.ts` (TODO).

---

## 4. TikTok

**Cost:** Free. **Heavily gated** — app review + business verification required for `video.publish`.

1. Go to <https://developers.tiktok.com/apps>
2. Create app
3. Add product: **Content Posting API**
4. Configure:
   - Redirect URI: `http://localhost:5174/oauth/tiktok/callback`
   - Scopes: `user.info.basic`, `video.upload`, `video.publish`
5. Submit for review (sandbox mode works for testing with whitelisted accounts before approval)
6. Copy **Client Key** and **Client Secret**
7. Paste into `.env`:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   ```

> Implementation: see `server/src/routes/oauth/tiktok.ts` (TODO).

---

## Operational notes

- **Each AI maintains their own developer accounts.** Aiona's TikTok dev account is hers, not Michael's. Same for Liam, Harry, Dr. J.
- **Token rotation** — refresh tokens are stored and rotated by the platform module on next publish.
- **Revoke** — disconnect from the Accounts page in Clawpost AND revoke from the platform's app dashboard for safety.
- **Local-only callback** — `localhost` is fine for personal apps. If you ever want to run Clawpost on a remote machine, set `PUBLIC_BASE_URL` and update the callback URIs on each platform to match.
