#!/bin/bash
# AgyCodeUI (self-hosted) - deploy del solo prodotto standalone (server/ + public/), porta 3080.
# Uso (come utente tino), dalla radice di questo repo:  bash deploy.sh
#
# Se anche il server SaaS (repo separato djabloo/AGYUI, di solito in /opt/agyui-server)
# deve aggiornarsi (perché usa questo stesso server/+public/ nei container utente),
# lancia poi il SUO deploy.sh con --no-build (se hai toccato solo qui) o senza (se serve
# ricostruire l'immagine container).
set -e
cd "$(dirname "$0")"

echo "== 1/2 controllo sintassi =="
for f in server/*.js server/api/*.js public/js/*.js; do
  [ -f "$f" ] && node --check "$f"
done
echo "ok"

echo "== 2/2 riavvio istanza standalone (agy.proseo.it) =="
pm2 restart agycodeui --update-env >/dev/null && echo "agycodeui riavviato"

echo "fatto."
echo "Nota: se il server SaaS (AGYUI) deve vedere queste modifiche, esegui anche il suo deploy.sh."
