// ─── Ultron Config ───────────────────────────────────────────────────────────
// Every time you start ngrok, copy the new https URL and paste it below.
// Then push ONLY this file to GitHub. Nothing else needs to change.
//
// Steps:
//   1. Run:  ngrok http 5056
//   2. Copy: https://xxxx.ngrok-free.app
//   3. Paste it below and save
//   4. git add config.js && git commit -m "update ngrok url" && git push
// ─────────────────────────────────────────────────────────────────────────────

const ULTRON_CONFIG = {
    BACKEND_URL : "https://YOUR-NGROK-URL.ngrok-free.app",  // ← update this every session
    API_KEY     : "ULTRON_TEST_KEY_123"                      // ← must match app.py
  };