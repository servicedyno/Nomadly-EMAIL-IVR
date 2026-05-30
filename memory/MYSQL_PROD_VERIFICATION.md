# MySQL Panel — Production Verification Checklist

**Why this exists:** The Emergent preview pod cannot reach the live WHM/cPanel host (`209.38.241.9`) because outbound port 2087/2083 traffic is firewalled. Every UAPI call from the preview returns `timeout of 30000ms exceeded`, which makes a real end-to-end test impossible from this environment. Run this checklist **once** against a deployed instance where the Node service can reach cPanel.

**Test cPanel account suggested:** any seed account (e.g. `gold____` style account on the WHM box). Account must have MySQL features enabled and a non-zero DB quota in its package.

---

## Preconditions
- [ ] Frontend deployed (Vercel / production)
- [ ] Node service reachable from the WHM host (cPanel returns HTTP 200 on `whmapi1 listaccts`)
- [ ] cPanel account exists with MySQL quota > 0
- [ ] You know the cPanel account's PIN (set via the bot)

## 1. Login + tab visibility
- [ ] Open `https://<prod-host>/panel`
- [ ] Sign in with cPanel-user + PIN
- [ ] **Database** tab is visible in the panel nav (between Email and Security) with the database icon
- [ ] Tab label localizes when switching languages (en → fr → zh → hi)

## 2. Databases CRUD
- [ ] Click **Database** tab — page loads within ~3 s with the real database list (no skeleton stuck longer than ~5 s)
- [ ] Click **New database** → modal opens with `<user>_` prefix chip
- [ ] Type `prodverify` → click **Create** → success toast `Database "<user>_prodverify" created.`
- [ ] The new DB appears in the Databases table with correct size (probably `0 B`)
- [ ] Click the trash icon next to `<user>_prodverify` → confirm → row disappears

## 3. Users CRUD + Privileges
- [ ] Click **New user** → modal opens with `<user>_` prefix chip + auto-generated password
- [ ] Click **Generate** → password regenerates (different value each click)
- [ ] Type `pvuser` + keep generated password → click **Create** → success toast
- [ ] The new user appears in the Database users table with chip "no databases"
- [ ] Re-create `<user>_prodverify` (see step 2 again, just create — don't delete)
- [ ] On the `<user>_pvuser` row, click the **Link** icon → modal opens
- [ ] Pick `<user>_prodverify` from the dropdown → leave "All privileges" checked → click **Grant access** → success toast
- [ ] The user row now lists `<user>_prodverify` as a database they have access to
- [ ] Click the chip on the Databases row to revoke → confirm → chip disappears
- [ ] Click the **Key** icon next to `<user>_pvuser` → modal opens with auto-generated password → **Save** → success toast
- [ ] Click the trash icon next to `<user>_pvuser` → confirm → row disappears
- [ ] Cleanup: delete `<user>_prodverify` DB

## 4. Privileges sub-selection
- [ ] Re-create a temp DB + user
- [ ] On the user, click **Link** → uncheck "All privileges" → check only `SELECT` + `INSERT` → **Grant**
- [ ] In a separate terminal: `mysql -u <user>_pvuser -p<password> <user>_proddb -e "DROP TABLE foo"` should fail with insufficient privileges (proving granular grant worked)
- [ ] Cleanup user + DB

## 5. Remote MySQL hosts
- [ ] Click **Remote MySQL** sub-tab — should be **immediately interactive** even if the Databases call is slow
- [ ] Type your real IP (or `203.0.113.%`) → click **Allow host** → success toast
- [ ] Host appears in the table
- [ ] From the allowed IP, try `mysql -h <prod-host> -u <user>_someuser -p<password> <user>_somedb` → connects
- [ ] Delete the host → connection from that IP fails next time

## 6. phpMyAdmin SSO
- [ ] Click **Open phpMyAdmin** in the toolbar
- [ ] New tab opens directly into phpMyAdmin for your cPanel user (no login prompt)
- [ ] Browse a table, run a SELECT — works
- [ ] Close the tab; SSO token expires within ~5 min (re-open should redo SSO)

## 7. Quota-exceeded upgrade banner (this is the critical UX gate)
**Setup:** in WHM, edit the user's cPanel package and set MySQL DB quota to the current count (so the next create will exceed the limit).
- [ ] On the panel, click **New database** → type `oneover` → **Create**
- [ ] The standard red error does NOT appear. Instead, the **purple "Your plan limit was reached"** banner appears with:
  - [ ] Title: "Your plan limit was reached"
  - [ ] Body explaining the limit
  - [ ] cPanel's raw error string in monospace font
  - [ ] A purple gradient **"Upgrade plan in the bot →"** CTA button
- [ ] Click the CTA → opens `https://t.me/nomadlybot` in a new tab
- [ ] Click the **×** to dismiss the banner — it disappears
- [ ] Same flow on users: lower the MySQL users limit, try to create one over → quota banner appears for users too
- [ ] After increasing the limit back, retrying the create succeeds (no banner)

## 8. i18n verification on real flows
For each language (fr / zh / hi):
- [ ] Switch language via the panel header switcher
- [ ] Open the Databases tab — header, sub-tabs, table column names all localized
- [ ] Open the Create DB modal — label, placeholder, hint, buttons all localized
- [ ] Trigger the quota banner — title + body + CTA all localized

## 9. Regression — original panel features still work
- [ ] Email tab still loads and lists email accounts
- [ ] Domains tab still works
- [ ] Files tab still works
- [ ] Security tab still works
- [ ] Geo Cloak tab still works

---

## Production-only diagnostics

If anything fails, check:

```bash
# 1. Did Node receive the request?
ssh <node-host> 'pm2 logs nodejs --lines 50' | grep mysql

# 2. Is cPanel UAPI returning data directly?
ssh <whm-host> "uapi --user=<cpuser> Mysql list_databases"

# 3. WHM session token creation (phpMyAdmin SSO)
ssh <whm-host> "whmapi1 create_user_session user=<cpuser> service=cpaneld app=phpmyadmin"

# 4. Verify the JWT carried by the panel frontend
curl -s -H "Authorization: Bearer $TOKEN" https://<prod-host>/api/panel/mysql/databases | jq
```

## Sign-off
- **Verified by:** _____________________ (operator name)
- **Date:** _____________________
- **cPanel account used:** _____________________
- **All checks passed:** [ ] Yes / [ ] No (list failures below)
