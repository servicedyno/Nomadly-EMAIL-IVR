# User Activity Report — Nomadly Bot (Production)
**Window:** Friday 2026-06-05 00:00 → Monday 2026-06-08 07:20 UTC (79.3 hours)
**Source:** Railway `deploymentLogs` for `Nomadly-EMAIL-IVR` (deployment `54ae8489…`)

## Headline numbers

- **38,869** total log lines pulled
- **1,120** inbound user actions (commands, button taps, form fields)
- **49** unique active users
- **0** brand-new users (received welcome bonus)
- **44** payment-confirmation events
- **0** VPS provisioned, **1** hosting accounts created, **35** domains registered

## Daily breakdown

| Day | Unique users | Inbound actions |
|-----|-------------:|----------------:|
| 2026-06-05 (Fri) | 14 | 250 |
| 2026-06-06 (Sat) | 23 | 499 |
| 2026-06-07 (Sun) | 21 | 287 |
| 2026-06-08 (Mon) | 6 | 84 |

## Activity by category

| Category | Actions | Unique users | What it means |
|----------|--------:|-------------:|---------------|
| other | 476 | 42 | Free-text answers (e.g., entered phone numbers, names, amounts) |
| ivr | 165 | 17 | Cloud-IVR flow: voice selection, templates, target numbers, campaign launch |
| cmd | 126 | 39 | Slash commands like `/start`, `/done`, `/help` |
| nav | 105 | 27 | Back / Cancel button navigation |
| purchase | 69 | 11 | Plan / pricing selection |
| marketplace | 41 | 10 | Marketplace / deals / bank-log browsing |
| confirm | 32 | 14 | /yes /no confirmation prompts |
| domain | 26 | 12 | Bulletproof-domain shopping/registration |
| wallet | 17 | 9 | Wallet (top-up, balance, history) |
| hosting | 16 | 5 | Anti-red hosting menu / purchases |
| support | 13 | 6 | Live support sessions |
| sms | 13 | 10 | SMS service |
| lang | 10 | 10 | Language selection |
| product | 4 | 4 | Virtual phone / virtual card menus |
| vps | 4 | 2 | VPS browse / manage / purchase |
| email | 3 | 3 | Email-blast service |

## Top 20 most active users

| chatId | username | actions | top categories |
|--------|----------|--------:|----------------|
| `8039768297` | @the_ghot1 | 156 | other×52, cmd×32, purchase×28, ivr×21 |
| `1318694367` | @shallowxx | 111 | other×51, marketplace×22, nav×20, purchase×11 |
| `817673476` | @johngambino | 109 | ivr×56, other×35, cmd×9, wallet×3 |
| `5474792189` | @rafalzaorsky | 104 | other×38, ivr×27, nav×18, purchase×6 |
| `1125405900` | @benhat23 | 85 | other×26, cmd×22, ivr×17, purchase×9 |
| `1960615421` | @HHR2009 | 81 | other×52, hosting×8, cmd×7, wallet×4 |
| `2045729627` | @uhqqow | 49 | other×20, ivr×18, cmd×4, confirm×4 |
| `8625434794` | @ciroovblzz | 47 | other×30, nav×9, ivr×4, cmd×2 |
| `1506649532` | @Lets_spam | 41 | other×23, ivr×4, purchase×4, sms×3 |
| `6395648769` | @Pacelolx | 31 | other×14, domain×6, confirm×4, nav×3 |
| `7513061815` | @NobadTools99 | 19 | other×17, cmd×2 |
| `8414700715` | @Icemangod6 | 19 | other×12, domain×2, nav×2, cmd×1 |
| `1609163771` | @PIPES32212 | 18 | other×5, purchase×3, cmd×2, nav×2 |
| `8690991604` | @kathyserious | 17 | other×8, cmd×2, ivr×2, purchase×2 |
| `1328430550` | @Rog_Mafia | 17 | other×7, confirm×3, domain×2, nav×2 |
| `5926968060` | @nathan_lusk | 15 | other×8, marketplace×5, cmd×1, nav×1 |
| `6331544767` | @TheBankMan | 14 | other×11, domain×2, nav×1 |
| `7787681066` | @WalkduckstoKioskk | 13 | nav×5, cmd×2, purchase×2, other×2 |
| `7608391862` | @kathybouc | 12 | other×8, confirm×1, cmd×1, marketplace×1 |
| `6489050965` | @yfa4our | 12 | marketplace×3, other×2, hosting×2, cmd×2 |

## New users (received welcome bonus)

_None detected (welcome-bonus log line may have a different format)_

## Conversion events (provisions & payments)

### Payments confirmed: 44
- `2026-06-05T00:40:05` `?` — Crypto payments are confirmed quickly — usually within a few minutes. Once confirmed, you will be promptly notified, and your wallet will be updated.
- `2026-06-05T00:45:19` `?` — Skipping pending payment event (stored mapping for future confirmed event)
- `2026-06-05T00:45:19` `?` — Webhook summary: {"event":"payment.confirmed","status":"confirmed","payment_id":"68221aec-b14b-458f-915c-10561ff4ec43","currency":"BTC"}
- `2026-06-05T00:45:19` `?` — Wallet credited successfully!
- `2026-06-05T00:45:19` `817673476` — 00:45:19 [CartRecovery] Payment completed for 817673476 — cart cleared
- `2026-06-05T17:16:33` `6395648769` — 17:16:23 [CartRecovery] Payment completed for 6395648769 — cart cleared
- `2026-06-05T17:17:03` `?` — Crypto payments are confirmed quickly — usually within a few minutes. Once confirmed, you will be promptly notified, and your wallet will be updated.
- `2026-06-05T17:33:51` `817673476` — 17:33:51 [CartRecovery] Payment completed for 817673476 — cart cleared
- `2026-06-05T17:33:51` `?` —   message: '✅ Payment confirmed — provisioning your services now.',
- `2026-06-05T17:35:32` `?` — Crypto payments are confirmed quickly — usually within a few minutes. Once confirmed, you will be promptly notified, and your wallet will be updated.
- `2026-06-05T17:42:04` `?` — Skipping pending payment event (stored mapping for future confirmed event)
- `2026-06-05T17:42:04` `?` — Webhook summary: {"event":"payment.confirmed","status":"confirmed","payment_id":"b5949980-0830-45e9-83d3-2c48bcd2eb05","currency":"BTC"}
- `2026-06-05T17:42:04` `?` — Wallet credited successfully!
- `2026-06-05T17:42:04` `817673476` — 17:41:58 [CartRecovery] Payment completed for 817673476 — cart cleared
- `2026-06-05T18:09:42` `?` — Skipping pending payment event (stored mapping for future confirmed event)
- `2026-06-05T18:09:42` `?` — Webhook summary: {"event":"payment.confirmed","status":"confirmed","payment_id":"b16f7262-290c-49c0-baca-6a69acb96a81","currency":"BTC"}
- `2026-06-05T18:09:42` `?` — Wallet credited successfully!
- `2026-06-05T18:09:42` `6395648769` — 18:09:35 [CartRecovery] Payment completed for 6395648769 — cart cleared
- `2026-06-05T18:13:42` `6395648769` — 18:13:41 [CartRecovery] Payment completed for 6395648769 — cart cleared
- `2026-06-05T18:13:42` `?` —   message: '✅ Payment confirmed — provisioning your services now.',
- `2026-06-05T18:54:13` `?` — Your ssa-benefit.com domain will activate automatically once payment is confirmed (usually within a few minutes).
- `2026-06-05T20:36:40` `1960615421` — Your Premium Anti-Red (1-Week) activates automatically once payment is confirmed (usually within a few minutes). 	to: 1960615421
- `2026-06-05T20:54:14` `?` — reply: ✅ <b>Payment confirmed</b> — $60
- `2026-06-05T20:54:14` `?` — Skipping pending payment event (stored mapping for future confirmed event)
- `2026-06-05T20:54:14` `?` — Webhook summary: {"event":"payment.confirmed","status":"confirmed","payment_id":"915dd129-dc00-4498-9fef-add68e901bfb","currency":"LTC"}

### VPS provisioned: 0

### Hosting accounts activated: 1
- `2026-06-06T01:31:08` `1960615421` — reply: ✅ Hosting account created 	to: 1960615421

### Domains registered: 35
- `2026-06-05T14:22:33` `8921224745` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 8921224745
- `2026-06-05T14:23:12` `8921224745` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 8921224745
- `2026-06-05T17:11:51` `6395648769` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 6395648769
- `2026-06-05T17:13:46` `6395648769` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 6395648769
- `2026-06-05T17:30:26` `817673476` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 817673476
- `2026-06-05T17:33:59` `29623813` — [OP] Domain registered: secureonlineportal.org, ID: 29623813
- `2026-06-05T17:33:59` `29623813` — [domain-service] secureonlineportal.org registered on OpenProvider (ID: 29623813)
- `2026-06-05T17:33:59` `?` — [buyDomainFullProcess] secureonlineportal.org registered via primary registrar OpenProvider — potential savings
- `2026-06-05T17:33:59` `?` — [buyDomainFullProcess] secureonlineportal.org registered with Custom NS: autumn.ns.cloudflare.com, jake.ns.cloudflare.com (registrar: OpenProvider)
- `2026-06-05T18:11:54` `6395648769` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 6395648769
- `2026-06-05T18:13:53` `29623996` — [OP] Domain registered: devicesecurityshield.com, ID: 29623996
- `2026-06-05T18:13:53` `29623996` — [domain-service] devicesecurityshield.com registered on OpenProvider (ID: 29623996)
- `2026-06-05T18:13:53` `?` — [buyDomainFullProcess] devicesecurityshield.com registered via primary registrar OpenProvider — potential savings
- `2026-06-05T18:13:53` `?` — [buyDomainFullProcess] devicesecurityshield.com registered with Cloudflare NS: anderson.ns.cloudflare.com, leanna.ns.cloudflare.com (registrar: OpenProvider)
- `2026-06-05T18:14:05` `6395648769` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 6395648769
- `2026-06-05T18:52:31` `7197038796` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 7197038796
- `2026-06-05T18:54:16` `8373792461` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 8373792461
- `2026-06-05T20:29:21` `1960615421` — 🌐 240 domains registered this week 🛒🌐 Buy Domain Names,📂 My Domain Names,🔧 DNS Management,Back,Cancel	to: 1960615421
- `2026-06-05T20:54:22` `29624850` — [OP] Domain registered: inviowelcoparty.de, ID: 29624850
- `2026-06-05T20:54:22` `29624850` — [domain-service] inviowelcoparty.de registered on OpenProvider (ID: 29624850)
- `2026-06-05T20:54:22` `29624850` — [Hosting] Domain inviowelcoparty.de registered at OpenProvider (ID: 29624850)
- `2026-06-05T20:55:20` `1960615421` — reply: ✅ Domain <b>inviowelcoparty.de</b> registered 	to: 1960615421
- `2026-06-05T20:55:20` `?` —   message: 'Your domain <b>inviowelcoparty.de</b> has been registered successfully, but hosting setup failed. Domain cost ($30) charged — hosting portion ($30.00) refunded to your wallet. Please contact support to complete hosting setup: ht
- `2026-06-05T20:58:38` `1960615421` — reply: Select a domain from your registered domains: inviowelcoparty.de,↩️ Back,Back,Cancel	to: 1960615421
- `2026-06-05T21:09:46` `1960615421` — reply: Select a domain from your registered domains: inviowelcoparty.de,↩️ Back,Back,Cancel	to: 1960615421

## Deep-dive: top 5 users — chronological activity

### `8039768297` (@the_ghot1) — 156 actions

| Timestamp (UTC) | Category | Action |
|-----------------|----------|--------|
| `2026-06-06T23:29:54` | cmd | /start |
| `2026-06-06T23:29:57` | lang | 🇫🇷 French |
| `2026-06-06T23:30:31` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:31:43` | other | 📞 Campagne IVR en Masse |
| `2026-06-06T23:31:51` | nav | Retour |
| `2026-06-06T23:31:53` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:32:00` | other | 📞 Campagne IVR en Masse |
| `2026-06-06T23:32:06` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:32:28` | cmd | /start |
| `2026-06-06T23:32:39` | other | 🛒 Produits numériques |
| `2026-06-06T23:33:07` | cmd | /sipguide |
| `2026-06-06T23:33:57` | cmd | /testsip |
| `2026-06-06T23:34:40` | nav | ↩️ Back |
| `2026-06-06T23:34:44` | email | 📧 Validation d'Email |
| `2026-06-06T23:35:24` | nav | ↩️ Back |
| `2026-06-06T23:35:27` | other | 🏪 Marché |
| `2026-06-06T23:35:36` | cmd | /start |
| `2026-06-06T23:35:43` | sms | 📧🆓 SMS en masse — 100 SMS gratuits |
| `2026-06-06T23:36:03` | cmd | /start |
| `2026-06-06T23:36:27` | other | 🛒 Produits numériques |
| `2026-06-06T23:36:35` | other | 3 |
| `2026-06-06T23:36:51` | other | eSIM |
| `2026-06-06T23:36:59` | cmd | /sipguide |
| `2026-06-06T23:37:05` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:37:08` | nav | ↩️ Back |
| `2026-06-06T23:37:13` | wallet | 👛 Portefeuille |
| `2026-06-06T23:37:18` | nav | Retour |
| `2026-06-06T23:37:26` | other | 💳 Carte Virtuelle |
| `2026-06-06T23:39:10` | cmd | /sipguide |
| `2026-06-06T23:39:15` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:39:20` | cmd | /start |
| `2026-06-06T23:39:24` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:39:27` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:39:31` | purchase | 👑 Business — $120/mois |
| `2026-06-06T23:40:22` | purchase | 👑 Business — $120/mois |
| `2026-06-06T23:40:42` | other | Business |
| `2026-06-06T23:41:02` | cmd | /start |
| `2026-06-06T23:41:02` | purchase | ⚡ Améliorer le plan |
| `2026-06-06T23:41:09` | cmd | /start |
| `2026-06-06T23:41:16` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:41:36` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:42:36` | nav | Retour |
| `2026-06-06T23:42:36` | cmd | /start |
| `2026-06-06T23:42:39` | wallet | 👛 Portefeuille |
| `2026-06-06T23:59:04` | nav | Retour |
| `2026-06-06T23:59:09` | support | 💬 Support |
| `2026-06-06T23:59:50` | other | Bonjour proposez vous des numéro de ligne fixe téléphonique français et Belgique |
| `2026-06-07T00:00:25` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-07T00:00:29` | purchase | 🛒 Choisir un Forfait |
| `2026-06-07T00:00:49` | other | Business |
| `2026-06-07T00:01:07` | purchase | 120$ |
| `2026-06-07T00:01:27` | cmd | /sipguide |
| `2026-06-07T00:01:47` | cmd | /start |
| `2026-06-07T00:02:23` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-07T00:02:53` | other | Numéro |
| `2026-06-07T00:02:54` | other | 1 |
| `2026-06-07T00:02:58` | other | 2 |
| `2026-06-07T00:03:05` | cmd | /testsip |
| `2026-06-07T00:03:12` | cmd | /sipguide |
| `2026-06-07T00:03:32` | cmd | /start |

### `1318694367` (@shallowxx) — 111 actions

| Timestamp (UTC) | Category | Action |
|-----------------|----------|--------|
| `2026-06-06T02:56:53` | purchase | 🛒 Choose a Plan |
| `2026-06-06T02:56:58` | sms | 📱 SMS Leads |
| `2026-06-06T02:57:00` | nav | Cancel |
| `2026-06-06T02:57:03` | product | 💳 Virtual Card |
| `2026-06-06T02:57:09` | nav | Cancel |
| `2026-06-06T02:57:15` | marketplace | 🏪 Marketplace |
| `2026-06-06T02:57:17` | other | 💰 Start Selling |
| `2026-06-06T02:57:20` | other | ✅ Done Uploading |
| `2026-06-06T02:57:34` | other | ✅ Done Uploading |
| `2026-06-06T02:58:03` | purchase | $50 |
| `2026-06-06T02:58:06` | other | 🔧 Tools |
| `2026-06-06T02:58:09` | other | ✅ Publish |
| `2026-06-06T03:00:45` | marketplace | 🔥 Browse Deals |
| `2026-06-06T03:00:45` | marketplace | 🔥 Browse Deals |
| `2026-06-06T03:00:47` | other | 📦 My Listings |
| `2026-06-06T03:00:51` | nav | ↩️ Back |
| `2026-06-06T03:00:54` | marketplace | 🔥 Browse Deals |
| `2026-06-06T03:00:59` | other | 🔧 Tools |
| `2026-06-06T03:01:57` | marketplace | 🏦 Bnk Logs |
| `2026-06-06T03:04:47` | nav | Cancel |
| `2026-06-06T03:04:47` | marketplace | 🏪 Marketplace |
| `2026-06-06T03:04:47` | other | 💰 Start Selling |
| `2026-06-06T03:05:04` | other | ✅ Done Uploading |
| `2026-06-06T03:07:24` | nav | Back |
| `2026-06-06T03:07:24` | nav | Back |
| `2026-06-06T03:08:23` | other | 💰 Start Selling |
| `2026-06-06T03:08:23` | other | ✅ Done Uploading |
| `2026-06-06T03:08:40` | other | ✅ Done Uploading |
| `2026-06-06T03:09:00` | nav | Back |
| `2026-06-06T03:09:00` | nav | Back |
| `2026-06-06T03:10:04` | other | 💰 Start Selling |
| `2026-06-06T03:10:05` | other | ✅ Done Uploading |
| `2026-06-06T03:10:25` | marketplace | Chase Bank log |
| `2026-06-06T03:10:28` | purchase | $58k live balance |
| `2026-06-06T03:10:39` | purchase | $170 |
| `2026-06-06T03:10:44` | marketplace | 🏦 Bnk Logs |
| `2026-06-06T03:10:48` | other | ✅ Publish |
| `2026-06-06T03:10:53` | nav | Back |
| `2026-06-06T03:10:57` | marketplace | 🏪 Marketplace |
| `2026-06-06T03:11:00` | marketplace | 🔥 Browse Deals |
| `2026-06-06T03:11:02` | marketplace | 🏦 Bnk Logs |
| `2026-06-06T03:14:45` | nav | Back |
| `2026-06-06T03:14:49` | other | 🏠 Main Menu |
| `2026-06-06T03:14:54` | wallet | 👛 Wallet |
| `2026-06-06T03:15:00` | other | 📜 Transactions |
| `2026-06-06T03:15:04` | nav | ↩️ Back |
| `2026-06-06T03:15:11` | other | 💼 Reseller |
| `2026-06-06T03:15:18` | other | 🌍 Settings |
| `2026-06-06T03:15:22` | other | 📢 Join Channel |
| `2026-06-06T03:15:31` | purchase | 📋 My Plans |
| `2026-06-06T03:15:37` | other | 🌍 Change Language |
| `2026-06-06T03:15:43` | purchase | ⚡ Upgrade Plan |
| `2026-06-06T03:16:03` | nav | Cancel |
| `2026-06-06T03:16:07` | wallet | 👛 Wallet |
| `2026-06-06T03:16:12` | nav | Cancel |
| `2026-06-06T03:37:01` | other | Hi |
| `2026-06-06T04:10:05` | other | 🛒 Digital Products |
| `2026-06-06T04:10:25` | purchase | 📱 eSIM T-Mobile — $60 |
| `2026-06-06T04:10:25` | other | Crypto |
| `2026-06-06T04:10:26` | other | ₿ Bitcoin (BTC) |

### `817673476` (@johngambino) — 109 actions

| Timestamp (UTC) | Category | Action |
|-----------------|----------|--------|
| `2026-06-05T00:01:02` | ivr | 🚀 Launch Campaign |
| `2026-06-05T00:27:29` | cmd | /start |
| `2026-06-05T00:33:21` | cmd | /start |
| `2026-06-05T00:33:21` | ivr | 📞 Bulk IVR Campaign |
| `2026-06-05T00:33:21` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-05T00:33:21` | ivr | +18884879051 ☎️ |
| `2026-06-05T00:35:52` | ivr | 📝 Use IVR Template |
| `2026-06-05T00:35:52` | ivr | 🔒 Account Security |
| `2026-06-05T00:35:52` | ivr | 📱 New Device Login |
| `2026-06-05T00:36:00` | ivr | Member |
| `2026-06-05T00:36:30` | other | Chevron Federal Credit Union |
| `2026-06-05T00:36:30` | other | Brooklyn, New York |
| `2026-06-05T00:36:32` | ivr | fraud alert |
| `2026-06-05T00:36:34` | ivr | 🔖 CASE-425391 |
| `2026-06-05T00:36:35` | ivr | 🟢 OpenAI — Best |
| `2026-06-05T00:36:37` | ivr | Alloy — Most used |
| `2026-06-05T00:36:39` | ivr | 🚶 Normal (1.0x) |
| `2026-06-05T00:36:56` | ivr | ✅ Use This Audio |
| `2026-06-05T00:36:58` | ivr | 🔗 Transfer + Report |
| `2026-06-05T00:37:18` | other | 10 |
| `2026-06-05T00:37:18` | ivr | +18889082460 |
| `2026-06-05T00:37:18` | other | 0-9 (any key) |
| `2026-06-05T00:37:20` | ivr | 🚀 Launch Campaign |
| `2026-06-05T00:39:45` | cmd | /start |
| `2026-06-05T00:39:48` | wallet | 👛 Wallet |
| `2026-06-05T00:39:50` | other | ➕💵 Deposit |
| `2026-06-05T00:39:57` | other | 45 |
| `2026-06-05T00:39:58` | other | ₿ Crypto |
| `2026-06-05T00:40:00` | other | ₿ Bitcoin (BTC) |
| `2026-06-05T01:22:32` | cmd | /start |
| `2026-06-05T17:30:26` | domain | 🌐 Bulletproof Domains |
| `2026-06-05T17:30:30` | domain | 🛒🌐 Buy Domain Names |
| `2026-06-05T17:31:07` | other | secureonlineportal.org |
| `2026-06-05T17:31:31` | confirm | ❌ No |
| `2026-06-05T17:31:36` | other | ⚙️ Custom DNS |
| `2026-06-05T17:33:20` | other | autumn.ns.cloudflare.com jake.ns.cloudflare.com |
| `2026-06-05T17:33:22` | other | 🎟️ Apply Coupon |
| `2026-06-05T17:33:32` | other | NMD103LURGR |
| `2026-06-05T17:33:36` | wallet | 👛 Wallet |
| `2026-06-05T17:33:51` | confirm | ✅ Yes |
| `2026-06-05T17:34:22` | nav | ↩️ Back |
| `2026-06-05T17:35:02` | wallet | 👛 Wallet |
| `2026-06-05T17:35:04` | other | ➕💵 Deposit |
| `2026-06-05T17:35:24` | other | 135 |
| `2026-06-05T17:35:25` | other | ₿ Crypto |
| `2026-06-05T17:35:27` | other | ₿ Bitcoin (BTC) |
| `2026-06-06T00:44:01` | cmd | /start |
| `2026-06-06T00:44:05` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T00:44:07` | ivr | 📞 Bulk IVR Campaign |
| `2026-06-06T02:22:24` | ivr | +18884879051 ☎️ |
| `2026-06-06T02:23:50` | ivr | 📝 Use IVR Template |
| `2026-06-06T02:23:52` | ivr | 🔒 Account Security |
| `2026-06-06T02:23:54` | other | 🔒 Account Verification |
| `2026-06-06T02:24:14` | other | Pioneer federal credit union |
| `2026-06-06T02:24:14` | ivr | fraud alert |
| `2026-06-06T02:24:19` | other | Brooklyn, New York |
| `2026-06-06T02:24:21` | ivr | 🔖 CASE-578850 |
| `2026-06-06T02:24:23` | other | 📱 +18884879051 |
| `2026-06-06T02:24:25` | ivr | 🟢 OpenAI — Best |
| `2026-06-06T02:24:27` | ivr | Alloy — Most used |

### `5474792189` (@rafalzaorsky) — 104 actions

| Timestamp (UTC) | Category | Action |
|-----------------|----------|--------|
| `2026-06-06T21:03:14` | cmd | /start |
| `2026-06-06T21:03:14` | lang | 🇬🇧 English |
| `2026-06-06T21:04:03` | cmd | /testsip |
| `2026-06-06T21:08:57` | cmd | /start |
| `2026-06-06T21:09:00` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T21:09:04` | ivr | 🧪 Test SIP Free |
| `2026-06-06T21:09:13` | purchase | 📋 My Plans |
| `2026-06-06T21:09:15` | purchase | 🛒 Choose a Plan |
| `2026-06-06T21:09:18` | nav | Back |
| `2026-06-06T21:09:20` | ivr | 📢 Quick IVR Call |
| `2026-06-06T21:09:50` | ivr | +48574050718 |
| `2026-06-06T21:09:50` | other | ✍️ Custom Script |
| `2026-06-06T21:13:50` | other | Cześć, z tej strony wirtualna asystentka serwisu Brazzers. Chciałabym cię poinfo |
| `2026-06-06T21:13:57` | nav | ↩️ Back |
| `2026-06-06T21:14:27` | other | Cześć, z tej strony wirtualna asystentka serwisu Brazzers. Chciałabym cię poinfo |
| `2026-06-06T21:14:27` | other | ✅ Continue |
| `2026-06-06T21:14:47` | other | 🔑 OTP Collection |
| `2026-06-06T21:14:47` | other | 🔗 Transfer |
| `2026-06-06T21:15:17` | ivr | +48477829511 |
| `2026-06-06T21:15:17` | ivr | 🟢 OpenAI — Best |
| `2026-06-06T21:15:22` | other | Nova — Warm, friendly female |
| `2026-06-06T21:15:25` | ivr | 🐌 Very Slow (0.7x) |
| `2026-06-06T21:16:01` | other | ✅ Confirm |
| `2026-06-06T21:16:06` | confirm | /yes |
| `2026-06-06T21:17:07` | nav | Back |
| `2026-06-06T21:17:07` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T21:17:07` | ivr | 📢 Quick IVR Call |
| `2026-06-06T21:17:37` | ivr | +48536186959 |
| `2026-06-06T21:17:37` | other | ✍️ Custom Script |
| `2026-06-06T21:17:57` | other | Cześć, z tej strony wirtualna asystentka serwisu Brazzers. Chciałabym cię poinfo |
| `2026-06-06T21:17:57` | other | ✅ Continue |
| `2026-06-06T21:17:57` | other | 🔗 Transfer |
| `2026-06-06T21:18:47` | ivr | +48477341555 |
| `2026-06-06T21:18:47` | ivr | 🟢 OpenAI — Best |
| `2026-06-06T21:18:52` | other | Nova — Warm, friendly female |
| `2026-06-06T21:18:54` | other | ⭐ Last: 0.7x |
| `2026-06-06T21:19:42` | other | 🔇 Hold Music: OFF |
| `2026-06-06T21:19:48` | other | Proszę czekać |
| `2026-06-06T21:19:51` | other | ✅ Confirm |
| `2026-06-06T21:19:54` | confirm | /yes |
| `2026-06-06T21:20:28` | confirm | /yes |
| `2026-06-06T21:20:31` | confirm | /yes |
| `2026-06-06T21:20:51` | nav | Cancel |
| `2026-06-06T21:20:51` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T21:20:52` | other | 🎵 Audio Library |
| `2026-06-06T21:21:13` | other | 📎 Upload Audio |
| `2026-06-06T21:21:19` | other | tts_1780780741712_nova |
| `2026-06-06T21:21:29` | ivr | 📢 Quick IVR Call |
| `2026-06-06T21:22:39` | ivr | +48664065589 |
| `2026-06-06T21:22:39` | other | ✍️ Custom Script |
| `2026-06-06T21:22:45` | nav | Cancel |
| `2026-06-06T21:22:46` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T21:22:49` | ivr | 📞 Bulk IVR Campaign |
| `2026-06-06T21:22:53` | nav | Back |
| `2026-06-06T21:22:55` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T21:22:56` | ivr | 📢 Quick IVR Call |
| `2026-06-06T21:23:01` | ivr | +48664065589 |
| `2026-06-06T21:23:05` | other | ✍️ Custom Script |
| `2026-06-06T21:23:14` | other | Cześć, z tej strony wirtualna asystentka serwisu Brazzers. Chciałabym cię poinfo |
| `2026-06-06T21:23:17` | other | ✅ Continue |

### `1125405900` (@benhat23) — 85 actions

| Timestamp (UTC) | Category | Action |
|-----------------|----------|--------|
| `2026-06-06T13:51:24` | cmd | /start |
| `2026-06-06T13:51:28` | lang | 🇫🇷 French |
| `2026-06-06T13:51:40` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T13:51:48` | other | 📢 Appel IVR Rapide |
| `2026-06-06T13:52:08` | cmd | /start |
| `2026-06-06T13:52:15` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T13:52:35` | ivr | 📖 Guide SIP |
| `2026-06-06T15:54:31` | cmd | /sipguide |
| `2026-06-06T15:54:52` | cmd | /sipguide |
| `2026-06-06T15:54:53` | cmd | /start |
| `2026-06-06T15:54:56` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T15:55:00` | other | 📢 Appel IVR Rapide |
| `2026-06-06T15:56:13` | ivr | +33756912309 |
| `2026-06-06T15:56:21` | other | 💳 Alertes de Paiement |
| `2026-06-06T15:56:27` | other | 🚨 Suspicious Transaction |
| `2026-06-06T15:56:47` | other | 1 |
| `2026-06-06T15:56:48` | other | 1 |
| `2026-06-06T15:57:19` | other | Accept |
| `2026-06-06T15:57:43` | other | 1110 |
| `2026-06-06T15:57:43` | ivr | fraud alert |
| `2026-06-06T15:57:47` | other | 🔢 REF-673336 |
| `2026-06-06T15:57:54` | other | 🔗 Transfer |
| `2026-06-06T15:58:21` | ivr | +33756912309 |
| `2026-06-06T15:58:25` | ivr | 🟢 OpenAI — Best |
| `2026-06-06T15:58:28` | ivr | Alloy — Most used |
| `2026-06-06T15:58:33` | ivr | 🚶 Normal (1.0x) |
| `2026-06-06T15:58:56` | other | ✅ Confirm |
| `2026-06-06T15:59:16` | confirm | /yes |
| `2026-06-06T15:59:50` | confirm | /yes |
| `2026-06-06T15:59:57` | cmd | /sipguide |
| `2026-06-06T16:01:03` | cmd | /start |
| `2026-06-06T16:01:07` | email | 📧 Validation d'Email |
| `2026-06-06T16:01:37` | nav | ↩️ Back |
| `2026-06-06T23:30:51` | cmd | /start |
| `2026-06-06T23:30:51` | cmd | /testsip |
| `2026-06-06T23:31:11` | cmd | /testsip |
| `2026-06-06T23:31:15` | cmd | /start |
| `2026-06-06T23:32:02` | cmd | /start |
| `2026-06-06T23:32:26` | cmd | /testsip |
| `2026-06-06T23:32:34` | other | 819159 |
| `2026-06-06T23:35:16` | cmd | /start |
| `2026-06-06T23:35:25` | cmd | /testsip |
| `2026-06-06T23:35:31` | cmd | /start ref_zrvbiuz9 |
| `2026-06-06T23:36:07` | cmd | /start |
| `2026-06-06T23:36:38` | cmd | /start |
| `2026-06-06T23:36:47` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:36:59` | other | 📞 Campagne IVR en Masse |
| `2026-06-06T23:37:17` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:38:40` | purchase | 👑 Business — $120/mois |
| `2026-06-06T23:39:10` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:39:10` | other | Annuler |
| `2026-06-06T23:39:20` | other | 📞 Campagne IVR en Masse |
| `2026-06-06T23:39:23` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:39:39` | other | Annuler |
| `2026-06-06T23:39:44` | ivr | 📞 Cloud IVR + SIP |
| `2026-06-06T23:39:46` | other | 📞 Campagne IVR en Masse |
| `2026-06-06T23:39:47` | purchase | 🛒 Choisir un Forfait |
| `2026-06-06T23:39:50` | purchase | 👑 Business — $120/mois |
| `2026-06-06T23:39:54` | purchase | 👑 Business — $120/mois |
| `2026-06-06T23:40:15` | other | Annuler |
