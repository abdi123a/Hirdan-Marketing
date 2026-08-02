# Meta multi-client connections — permanent fix runbook

**Status:** Code mitigation shipped in `8a60b7f`. Meta-side migration below is still to do.

---

## 0. The problem in one paragraph

The Facebook Login for Business configurations for the **Hirdan Marketing** app
(`Facebook Page` = `1747617486591892`, `Instagram Account` = `2114795212461306`)
both use **Access token: User access token**. With that token type the Page grant
belongs to **(app × one Facebook user)** — a single grant, not one per CRM client.
Every run of the login dialog **replaces** that grant, and Meta immediately revokes
every Page token minted under the previous one.

Because all client Pages are administered by the same personal Facebook account,
connecting Papparoti revoked Tokka and Te'Amo. The error Meta returns —
*"The user must be an administrator, editor, or moderator of the page in order to
impersonate it"* — is its generic "no valid Page grant" message. It does **not**
mean admin rights were lost.

Sync is the detector, not the cause: `fetchPlatformInsights` uses the stored page
token first and only re-mints after an auth error. The tokens were already dead.

---

## 1. Immediate recovery (do this now)

1. Open **Connect** for any one client.
2. In **Facebook's** permission screen, keep **all** client Pages checked —
   Tokka, Papparoti, Te'Amo — or choose *all current and future Pages*.
3. In the app's picker, select **only that client's** Page/IG account.
4. Done. The shipped reconcile pass re-mints tokens for every client whose Page
   was in that grant, in one shot. You do not need to repeat per client.

If a client still shows **Issue** afterwards, its Page was not in the grant —
repeat with that Page checked.

---

## 2. What the shipped code does (and its ceiling)

| Behaviour | Where |
| --- | --- |
| One grant re-mints tokens for **every** client whose Page it contains | `reconcileSiblingMetaAccounts` |
| Pages dropped from a grant are probed and, only if truly revoked, marked `expired` + notified | `isPageTokenStillValid` |
| One Page = one client; blocks a second client claiming it | `findPageOwner` |
| Picker locks Pages owned by another client, excludes from Select All | `SocialAccountPickerPage.tsx` |

**Ceiling:** this can only heal Pages that were *included* in a grant. Nothing in
code can recover a Page you unchecked in the Facebook dialog. That is why the
migration below matters.

---

## 3. Permanent fix — System User access tokens

### Why it works

Assets attach to a **business/system user** rather than to a per-login user grant.
Adding client B's Page is **additive** — it does not revoke client A. This removes
the failure mode entirely rather than mitigating it.

### Prerequisites

- A **Meta Business portfolio** at `business.facebook.com`.
- Every client Page **and** its linked Instagram Business account must be *owned by*
  that portfolio — not merely admin'd by your personal account. Ownership transfer
  is done in **Business settings → Accounts → Pages → Add**.
- `business_management` stays in the configuration (already present in both).

### Steps

1. **Create or confirm the Business portfolio**, then complete Business Verification
   (see §4 — it is also required for App Review, so do it once).
2. **Bring each Page into the portfolio.** For Pages you already admin personally,
   use *Add a Page* → *Claim*. Instagram accounts come in via
   **Accounts → Instagram accounts**, and must be Professional/Business accounts
   linked to their Page.
3. **Create a system user**: Business settings → Users → System users → Add.
   Give it the **Admin** role.
4. **Assign assets** to that system user — every client Page and IG account, with
   *Full control* / *Manage* so content publishing and insights both work.
5. **Create a new FLB configuration** in the App Dashboard with
   **Access token type: System user access token**. This is the configuration where
   Meta *will* let you select assets — the note in your current config
   ("You can't select assets because you chose to use a user access token") is
   exactly what changes here.
6. **Copy the new configuration IDs** into the server `.env` at
   `/home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/.env`:

   ```
   META_CONFIG_ID_FACEBOOK=<new fb config id>
   META_CONFIG_ID_INSTAGRAM=<new ig config id>
   ```

   > These live only on the VPS — they are deliberately not in the repo or in CI.
   > They are currently **absent from `server/.env` and `server/.env.production`**,
   > which is why Meta OAuth cannot be exercised locally. Add them to your local
   > `.env` too if you want to test the flow on your machine.

7. **Restart** the API: `pm2 restart api`.

### Code changes required

The existing OAuth code path largely survives, because the authorization-code
exchange is unchanged. Verify these three points against Graph API Explorer using
a system user token **before** cutting over:

- **Asset listing.** `getPagesWithInstagram` calls `/me/accounts`. Confirm this
  returns the assigned Pages for a system user token; if it does not in your setup,
  switch it to `/{business-id}/owned_pages` and map the same fields.
- **Token lifetime.** FLB system user tokens are long-lived (typically 60 days).
  A **never-expiring** token can instead be generated directly in Business settings
  for the system user. Keep `refreshExpiringTokens` either way — it is harmless and
  covers the 60-day case.
- **`refreshAccountToken`** (`platform-router.service.ts`) exchanges the stored
  token via `getMetaLongLivedToken`. Confirm that call is valid for the token type
  you end up storing; if you move to a never-expiring system user token, short-circuit
  the Meta branch to reuse the stored token as-is.

### Cutover

Do it on one client first. Reconnect, confirm Sync returns real numbers, then
reconnect the rest. The one-Page-one-client guard now prevents a mis-click from
merging clients during the transition.

---

## 4. App Review / publishing checklist

The app is currently **Unpublished** with **Standard Access**. In that state only
people holding an app role (Admin/Developer/Tester) can grant permissions — which
is why it works with your own Facebook account and will fail the instant a client
tries to connect their own Page.

### Before you can submit

- [ ] **Business Verification** completed for the portfolio (legal name, address,
      and a verification document). Allow several business days.
- [ ] **Privacy Policy URL** — public, reachable, describing what Meta data you store.
- [ ] **Terms of Service URL**.
- [ ] **Data Deletion** — either instructions URL or a deletion callback endpoint.
- [ ] App icon (1024×1024) and a Category set.
- [ ] A **demo login to the CRM** for the reviewer. They cannot approve what they
      cannot reach — this is the single most common rejection cause.

### Advanced Access to request

Standard Access is not enough for client-owned Pages. Request Advanced Access for:

| Permission | Needed for |
| --- | --- |
| `pages_show_list` | listing Pages during connect |
| `pages_manage_posts` | publishing to Facebook Pages |
| `pages_manage_metadata` | Page metadata |
| `pages_read_engagement` | Page + IG engagement metrics |
| `read_insights` | Page insights |
| `business_management` | business-owned assets / system user flow |
| `instagram_basic` | IG account identity |
| `instagram_content_publish` | publishing to Instagram |
| `instagram_manage_insights` | IG insights |
| `pages_read_user_content` | **only if re-added** — Page posts and comments. Dropped in `c458ec7`; re-add it before submitting if you want post-level analytics or comment management, because adding it later means another review round. |

### Per-permission submission

Each one needs, in Meta's form:

1. A plain description of *why your app needs it*, in product terms.
2. **Step-by-step reproduction instructions** the reviewer can follow in your CRM.
3. A **screencast** showing that exact permission doing something visible in your
   app — not a slide, not the Graph Explorer. Record the real connect → publish →
   analytics flow.

Submit all permissions together in one review round. Piecemeal submissions
serialise the wait.

---

## 5. Reference — verified facts

- Live API: `https://api.hirdanmarketing.com/api/health` → `{"status":"ok","database":"connected"}`.
- Deploy: GitHub Actions → rsync → `pm2 restart api` (`.github/workflows/deploy.yml`),
  branch `clean-version`. Migrations run via `prisma migrate deploy` behind a
  baseline guard — never `db push`.
- Server `.env` is managed on the VPS and is not in CI.
- `SocialAccount` unique key is `[clientId, platform, platformUserId]` — the same
  Page *can* exist under two clients at the database level, which is why the
  application-level `findPageOwner` guard is required.
