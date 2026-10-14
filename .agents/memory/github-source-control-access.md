---
name: GitHub source-control access
description: Distinguishes an account-level GitHub connection from usable repository write access in the workspace.
---

A GitHub account connection can appear active or healthy while the workspace's Git CLI lacks usable write authentication. Public repository reads may still work.

**Why:** An attempted push was rejected despite the connected status, leaving a README change unpublished.

**How to apply:** Before a repository write, verify that the target repo is linked to this Repl and test the actual remote. On authentication rejection, do not request or handle tokens; ask the user to reconnect through Replit's Git pane or integration, then retry once.
