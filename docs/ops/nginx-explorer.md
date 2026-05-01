# Enabling /explorer on VPS 1 nginx

Blockscout runs on VPS 1 at `localhost:4001` (in the `blockscout-blockscout-1` container,
bound to the 600GB volume at `/mnt/HC_Volume_105330957/blockscout/`).

> Pre-cutover (Hetzner) it was reachable from VPS 2 via the private net at
> `http://10.2.0.3:4001/`. Post-Netcup-cutover, the private net is gone — see
> CLAUDE.md "Netcup migration". Inter-VPS calls now go over public IPs
> (`159.195.78.238` for VPS 1) and are gated by UFW.

For external access via the main nginx at `http://api.generalmarket.io/explorer/`
(or `http://116.203.156.98/explorer/` pre-cutover, `http://159.195.78.238/explorer/`
post-cutover), add the following location blocks inside the `server {}` block of
`/etc/nginx/sites-enabled/default`:

```nginx
    # Blockscout explorer (lives on 600GB volume)
    location /explorer/ {
        proxy_pass http://127.0.0.1:4001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Prefix /explorer;
        proxy_read_timeout 300;
    }

    location /explorer {
        return 301 /explorer/;
    }
```

Then:

```bash
ssh index-maker/prod/be
sudo nano /etc/nginx/sites-enabled/default   # paste the blocks above
sudo nginx -t && sudo systemctl reload nginx
```

If blockscout's frontend misroutes asset paths under the subpath, fall back to a
dedicated port (4444 served by an nginx sidecar container already running on
`0.0.0.0:4444`) or a subdomain.
