# SnapQuiz

Point your phone at a question. SnapQuiz reads it from the live camera (no screenshots) and shows the answer. Tap **DONE** to scan the next one.

## Render
- Runtime: Docker (uses the `Dockerfile`)
- Environment variables:
  - `ANTHROPIC_API_KEY`: your Claude API key
  - `ACCESS_KEY`: any secret word. Open the app with `https://<your-app>.onrender.com/?k=<ACCESS_KEY>` once; the phone remembers it after that.

## On your PC
Double-click `START SnapQuiz.cmd`, then scan the QR code with your phone.

## Customer access codes
`ACCESS_KEY` is your own unlimited code. Add customers with one more env var:

```
ACCESS_CODES=alice77:Alice:200, bob99:Bob
```
Format is `code:Name:scansPerDay` (limit optional, default 300; change the default with `DEFAULT_DAILY_LIMIT`). Edit the variable and Render redeploys, which adds or removes a customer.

See usage at `https://<your-app>.onrender.com/usage?k=<ACCESS_KEY>`. Counts reset when the server restarts.
