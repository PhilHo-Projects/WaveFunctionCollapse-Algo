# Production deployment

The public site is **https://philippeho.dev/wfc/**. The Vite base path remains `/wfc/`, including direct learning/demo routes and GLB assets.

## Existing hosting

- Hetzner host: `95.217.6.255`, SSH user `phil`.
- Manual Docker Compose service: `/opt/wfc/docker-compose.yml`, container `wfc`.
- Static directory: `/home/phil/projects/wfc`, mounted read-only at `/usr/share/nginx/html/wfc`.
- Nginx configuration: `/opt/wfc/nginx.conf`; SPA fallback is `/wfc/index.html`.
- Traefik route: `/data/coolify/proxy/dynamic/wfc.yaml`; the `/wfc` prefix is preserved.
- This is an existing manual service, not a Coolify application resource. Pushing Git does not deploy it; the GitHub repository has no deployment webhook.

## Release procedure

The 2026-10-19 visual upgrade is published from `codex/canal-town` in `PhilHo-Projects/WaveFunctionCollapse-Algo`. The user authorized committing, pushing and deploying after the local implementation was complete.

1. Run the project checks and `npm run build` in the intended checkout.
2. Commit and push the release source. Record its full Git SHA in `dist/release.json` with the build timestamp.
3. Package only `dist/` and upload it to a new `/home/phil/releases/wfc/<sha>/` directory on the host.
4. Back up the current static directory beside the release. Verify the extracted entrypoint and GLB before publishing.
5. Copy new assets into the existing static directory, retaining old hashed assets for already-open clients. Replace `index.html` last using a temporary sibling and atomic rename. The existing bind mount and container stay in place.
6. Verify the public entrypoint, `/wfc/learn`, `/wfc/release.json`, hashed JS/CSS and the GLB. Compare the served commit and asset hashes to the intended build, then smoke-test the live browser.

The release archive, expanded build and previous-site backup remain on the host for rollback. Restore the previous assets and entrypoint from that backup to roll back. Static releases contain no application secrets or user data; saved towns stay in each browser's local storage.
