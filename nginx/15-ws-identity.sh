#!/bin/sh
# Runs before 20-envsubst-on-templates.sh. Generates the identity include: the alias locations when WS_IDENTITY_UPSTREAM is set, otherwise an empty file.
set -e
OUT=/etc/nginx/ws-identity.inc
if [ -n "${WS_IDENTITY_UPSTREAM:-}" ]; then
  : "${WS_IDENTITY_HOST:=localhost}"; : "${WS_RESOLVER:=127.0.0.11}"
  export WS_IDENTITY_UPSTREAM WS_IDENTITY_HOST WS_RESOLVER
  envsubst '${WS_IDENTITY_UPSTREAM} ${WS_IDENTITY_HOST} ${WS_RESOLVER}' < /etc/nginx/identity.inc.template > "$OUT"
  echo "ws-identity: alias routes ON (upstream $WS_IDENTITY_UPSTREAM)"
else
  : > "$OUT"
  echo "ws-identity: alias routes OFF (WS_IDENTITY_UPSTREAM not set): static default favicon.ico / og image only"
fi
