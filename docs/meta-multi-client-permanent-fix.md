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

> ### ⚠️ This is an agency tool — do NOT claim client Pages
>
> Hirdan manages Pages **on behalf of clients** (the Buffer / Hootsuite / Metricool
> model). The clients own their Pages and grant admin access; we never own them.
>
> **Claiming a Page transfers ownership** and is the wrong move here — do not use
> *Add a Page → Claim* on a client's Page. The correct mechanism is **Partner
> access**: the client shares their Page with our Business portfolio and keeps
> ownership. See §3b.

### Prerequisites

- A **Meta Business portfolio** at `business.facebook.com`.
- Each client grants that portfolio **partner access** to their Page and Instagram
  account (§3b). Ownership stays with the client.
- `business_management` stays in the configuration (already present in both).

### Steps

1. **Create or confirm the Business portfolio**, then complete Business Verification
   (see §4 — it is also required for App Review, so do it once).
2. **Get partner access to each client Page** — see §3b below. Do not claim them.
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

**None expected — this is a dashboard-only change.** The one real incompatibility
was fixed in `09138e4`: system user tokens are already long-lived and cannot be
passed through `fb_exchange_token`, which would have thrown at
`getMetaLongLivedToken`. It now falls back to using the token as-is, but only
after `/debug_token` confirms the token really is long-lived — so a transient
exchange failure can't quietly store a 1-hour token behind a 60-day expiry.
`refreshAccountToken` goes through the same helper, so it inherits the fix.

One thing left to confirm once the config exists — it needs a real system user
token, so it can't be checked in advance:

- **Asset listing.** `getPagesWithInstagram` calls `/me/accounts`. In Graph API
  Explorer, call `/me/accounts` with the system user token and check it returns
  the assigned Pages. With partner-shared Pages this may return nothing — in that
  case it becomes `/{business-id}/client_pages` (partner access) or
  `/{business-id}/owned_pages`. Same fields either way, ~10 lines of change.

`refreshExpiringTokens` should stay either way: FLB system user tokens are
typically 60-day, and a never-expiring token simply never trips the threshold.

### Cutover

Do it on one client first. Reconnect, confirm Sync returns real numbers, then
reconnect the rest. The one-Page-one-client guard now prevents a mis-click from
merging clients during the transition.

---

## 3b. Partner access — the agency mechanism

This is how a client grants Hirdan access **without giving up ownership**. It is
the correct substitute for claiming, and it is what makes the system-user path
viable for an agency.

### What you send the client (once per client)

Give them your **Business portfolio ID** (Business settings → Business info) and
these steps:

1. Go to `business.facebook.com` → **Business settings**.
2. **Users → Partners → Add → Give a partner access to your assets.**
3. Paste Hirdan's Business portfolio ID.
4. Select their **Page** → grant *Manage Page* / Full control.
5. Select their **Instagram account** → grant full access.

The client keeps ownership. They can revoke at any time. If a client's Page is not
already in a Business portfolio, they will be prompted to create one — that is
normal and free.

### After they accept

The Page and IG account appear under **Accounts** in your portfolio as
*shared with you*. Assign them to your system user exactly like owned assets
(§3 step 4).

### Why this beats the current setup

| | Personal-admin (today) | Partner access + system user |
| --- | --- | --- |
| Grant model | one per Facebook user, **replaced** each login | per-asset, **additive** |
| Connecting client B | revokes client A | no effect on A |
| Client offboards | you must remember to remove | client revokes, clean |
| Survives you losing personal admin | no | yes |

### If a client won't do it

Fall back to the agency-wide single-grant model (§1): one Facebook login with
**every** client Page checked, then assign Pages to clients inside the CRM. The
shipped code supports this. It works — it is just fragile, because one narrowed
dialog breaks the others.

---

## 4. App Review / publishing checklist

The app is currently **Unpublished** with **Standard Access**. In that state only
people holding an app role (Admin/Developer/Tester) can grant permissions — which
is why it works with your own Facebook account and will fail the instant a client
tries to connect their own Page.

**For an agency tool this is not optional.** Hirdan manages Pages it does not own,
on behalf of paying clients. Running that on a development-mode app works only for
as long as every Page happens to be admin'd by the one Facebook account that also
holds an app role. The moment a client grants access through their own login — or
partner access replaces personal admin — Standard Access stops being enough.
Treat App Review as required work, not a later nicety.

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
