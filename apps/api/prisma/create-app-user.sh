#!/bin/bash
set -euo pipefail

case "${APP_DB_USER:-}" in
  ''|*[!a-zA-Z0-9_]*)
    echo "APP_DB_USER must contain only letters, digits, or underscores" >&2
    exit 1
    ;;
esac

case "${MYSQL_DATABASE:-}" in
  ''|*[!a-zA-Z0-9_]*)
    echo "MYSQL_DATABASE must contain only letters, digits, or underscores" >&2
    exit 1
    ;;
esac

app_password=$(printf '%s' "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}" | sed "s/'/''/g")

mysql --protocol=socket --user=root --password="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}" <<SQL
SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_BACKSLASH_ESCAPES');
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'%' IDENTIFIED BY '${app_password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${APP_DB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
