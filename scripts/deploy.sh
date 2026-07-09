#!/usr/bin/env bash
# One-command deploy: build, then rsync dist/ to the server over SSH (fast,
# incremental, exact mirror). Falls back to the DirectAdmin zip+extract API
# when SSH is unavailable. Config lives in .env.deploy (gitignored); see
# .env.deploy.example.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.deploy ]]; then
  echo "Missing .env.deploy (copy .env.deploy.example and fill it in)" >&2
  exit 1
fi
set -a
source .env.deploy
set +a
: "${DA_HOST:?}" "${DA_USER:?}" "${DA_PATH:?}" "${SITE_URL:?}"
SSH_HOST="${SSH_HOST:-${DA_HOST%%:*}}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_irvingernesto}"

echo "- building"
pnpm build >/dev/null

deploy_rsync() {
  [[ -f "$SSH_KEY" ]] || return 1
  echo "- rsync to $SSH_HOST:$DA_PATH"
  rsync -az --delete \
    -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new" \
    dist/ "$DA_USER@$SSH_HOST:.$DA_PATH/"
}

deploy_api() {
  : "${DA_PASS:?DA_PASS required for the API fallback}"
  api() { curl -sk -u "$DA_USER:$DA_PASS" "$@"; }
  fail_if_error() {
    if grep -q 'error=1' <<<"$1"; then
      echo "DirectAdmin API error: $1" >&2
      exit 1
    fi
  }
  echo "- zipping dist"
  rm -f site.zip
  (cd dist && zip -qr ../site.zip .)
  echo "- uploading site.zip"
  out=$(api -X POST "https://$DA_HOST/CMD_API_FILE_MANAGER" \
    -F 'action=upload' -F "path=$DA_PATH" -F 'file1=@site.zip')
  fail_if_error "$out"
  # Old hashed assets pile up forever; drop the folder right before extract so
  # the 404 window for live visitors is a second or two.
  api -X POST "https://$DA_HOST/CMD_API_FILE_MANAGER" \
    --data-urlencode 'action=multiple' --data-urlencode 'button=delete' \
    --data-urlencode "select0=$DA_PATH/_astro" >/dev/null || true
  echo "- extracting"
  out=$(api -X POST "https://$DA_HOST/CMD_API_FILE_MANAGER" \
    --data-urlencode 'action=extract' \
    --data-urlencode "path=$DA_PATH/site.zip" \
    --data-urlencode "directory=$DA_PATH")
  fail_if_error "$out"
  echo "- removing remote zip"
  out=$(api -X POST "https://$DA_HOST/CMD_API_FILE_MANAGER" \
    --data-urlencode 'action=multiple' --data-urlencode 'button=delete' \
    --data-urlencode "select0=$DA_PATH/site.zip")
  fail_if_error "$out"
}

if ! deploy_rsync; then
  echo "- ssh unavailable, falling back to the DirectAdmin API"
  deploy_api
fi

echo "- verifying $SITE_URL"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE_URL/")
if [[ "$code" != "200" ]]; then
  echo "Live check failed: HTTP $code" >&2
  exit 1
fi
echo "deployed: $SITE_URL (HTTP $code)"
echo "note: if Cloudflare serves stale HTML, purge its cache in the dashboard."
