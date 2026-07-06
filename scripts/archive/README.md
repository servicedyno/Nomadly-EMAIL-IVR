# scripts/archive — user-specific recovery scripts

Contents: one-off recovery / audit / diagnostic scripts targeting specific customers
(hhr2009, davion419, leprechaun, ciroovblzz, thebiggestbag22, chatId 7191777173).

These are historical artifacts. Their **users** are referenced by name in
/app/js/tests/*, /app/tests/*, and /app/backend/tests/* for regression-anchor
attribution — but those tests do NOT invoke these scripts. Nothing in the live
runtime (JS + FastAPI + supervisor + package.json) imports anything here.

If a similar incident happens again, adapt one of these as a starting template.
