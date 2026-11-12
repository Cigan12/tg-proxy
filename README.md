# Private Telegram Bot API relay

This Cloudflare Pages Function forwards Telegram Bot API requests and file downloads. It contains no analytics, message logging or database. It requires a random secret path and forwards requests only to `api.telegram.org`.

1. Create a Pages project connected to this repository. Framework: None, build command: empty, output directory: `public`.
2. Create a secret named `PROXY_SECRET` in the Pages project settings. Generate one using `openssl rand -hex 32`; only letters, digits, `_` and `-` are accepted, 32–128 characters.
3. Redeploy after adding the secret. In Buro14, set `TELEGRAM_API_URL=https://YOUR-PROJECT.pages.dev/YOUR_SECRET` and redeploy the API.

The URL is a credential: do not share it or log full request URLs. Telegram bot tokens also appear in request paths. Configure Cloudflare request logging and any additional proxies accordingly. This endpoint authenticates by secret URL path; it does not add user or bot access controls. Requests contain confidential messages and files. Cloudflare processes the traffic. Do not deploy from an unreviewed branch.

The relay does not implement local Bot API server features or long-term storage. Requests and file responses are streamed. A long-poll request consumes a Cloudflare request even when no message is received; monitor plan quotas.
