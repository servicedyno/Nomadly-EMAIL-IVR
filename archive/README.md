# Archive — one-off scripts kept for historical reference

Contents:
- **root Python files** (audit_origin_leaks.py, backend_test*.py, cleanup_remaining_leaks.py,
  email_blast_test_simple.py, migrate_all_zones_to_tunnel.py, mongo_debug.py,
  setup_zero_trust.py, webhook_sim.py, webhook_sim_results.json) — one-off migration /
  simulation / debug scripts from earlier incidents. Not imported by the running app.
- **audit docs** (CODEBASE_AUDIT_REPORT.md, CODEBASE_IMPROVEMENTS_IMPLEMENTATION.md) —
  earlier audit output, superseded by /app/memory/*.md.

If anything here is needed again, move it back to the appropriate parent directory.
Nothing here is loaded by supervisor, package.json, or any live route.
