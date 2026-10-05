#!/bin/bash
# Alterna el proyecto entre PostgreSQL y SQLite.
#
# Uso (desde WSL/Git Bash):
#   ./scripts/switch-db.sh            # cambia al provider contrario
#   ./scripts/switch-db.sh sqlite     # fuerza un provider concreto
#   ./scripts/switch-db.sh postgresql
#
# Que hace:
#   1. Respalda prisma/migrations en prisma/migrations.bak-<timestamp>
#   2. Mueve el provider en prisma/schema.prisma
#   3. Reescribe DATABASE_URL en .env
#   4. Genera un baseline NUEVO para el dialecto destino y lo aplica
#   5. Regenera el cliente Prisma
#
# OJO: cada cambio de provider resetea la base de datos. Las migraciones
# antiguas no son portables entre dialectos (SQLite usa PRAGMA, que
# PostgreSQL no entiende), por eso se respaldan en vez de borrarse.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Si el script se copio fuera de scripts/, cae al directorio actual
if [ ! -f "$ROOT/prisma/schema.prisma" ] && [ -f "$PWD/prisma/schema.prisma" ]; then
    ROOT="$PWD"
fi
cd "$ROOT"

# El .db vive en la raiz del proyecto, no dentro de prisma/
SQLITE_URL="file:./dev.db"
POSTGRES_URL="postgresql://postgres:123456@localhost:5432/workflow_db?schema=public"

SCHEMA_FILE="prisma/schema.prisma"
ENV_FILE=".env"
MIGRATIONS_DIR="prisma/migrations"

STAMP="$(date +%Y%m%d-%H%M%S)"

info()    { printf '\033[0;36m[i]\033[0m %s\n' "$1"; }
success() { printf '\033[0;32m[OK]\033[0m %s\n' "$1"; }
error()   { printf '\033[0;31m[!]\033[0m %s\n' "$1" >&2; }

# Provider actual segun prisma/schema.prisma
get_current_provider() {
    awk '/^datasource db \{/,/^\}/' "$SCHEMA_FILE" \
        | grep -oE 'provider = "[^"]+"' \
        | head -1 \
        | cut -d'"' -f2
}

# Reemplaza solo el provider del bloque datasource (no el del generator)
set_provider() {
    local new_provider="$1"
    sed -i -E "/^datasource db \{/,/^\}/ s/provider = \"[a-z]+\"/provider = \"$new_provider\"/" "$SCHEMA_FILE"

    if [ "$new_provider" = "sqlite" ]; then
        # SQLite necesita el engine binario (Rust)
        if ! grep -q 'engineType = "binary"' "$SCHEMA_FILE"; then
            sed -i '/provider = "prisma-client-js"/a\  engineType = "binary"' "$SCHEMA_FILE"
        fi
    else
        sed -i '/engineType = "binary"/d' "$SCHEMA_FILE"
    fi
}

set_db_url() {
    local new_url="$1"
    if grep -q "DATABASE_URL" "$ENV_FILE"; then
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$new_url\"|" "$ENV_FILE"
    else
        echo "DATABASE_URL=\"$new_url\"" >>"$ENV_FILE"
    fi
}

# ¿Respond Postgres? Sin esto el reset falla con un error confuso
check_postgres() {
    local url="$1"
    local host port
    host="$(printf '%s' "$url" | sed -E 's|.*@([^:/]+).*|\1|')"
    port="$(printf '%s' "$url" | sed -nE 's|.*@[^:]+:([0-9]+).*|\1|p')"
    port="${port:-5432}"

    if ! command -v pg_isready >/dev/null 2>&1; then
        info "pg_isready no disponible; se omite la comprobacion previa"
        return 0
    fi

    if ! pg_isready -h "$host" -p "$port" >/dev/null 2>&1; then
        error "PostgreSQL no responde en $host:$port desde este shell."
        cat >&2 <<EOF

    Si PostgreSQL corre en Windows y ejecutas este script dentro de WSL,
    WSL no suele alcanzar el puerto 5432 del host. Opciones:
      - Ejecuta el script con Git Bash (bash) desde Windows, donde si hay acceso.
      - O configura PostgreSQL en Windows para escuchar en la interfaz de WSL
        (listen_addresses y el firewall de Windows).

EOF
        return 1
    fi
    success "PostgreSQL responde en $host:$port"
}

backup_migrations() {
    if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
        local dest="prisma/migrations.bak-$STAMP"
        cp -r "$MIGRATIONS_DIR" "$dest"
        success "Migraciones respaldadas en $dest"
    fi
}

remove_migrations() {
    rm -rf "$MIGRATIONS_DIR"
    mkdir -p "$MIGRATIONS_DIR"
}

main() {
    local target="${1:-}"

    [ -f "$SCHEMA_FILE" ] || { error "No existe $SCHEMA_FILE"; exit 1; }

    local current
    current="$(get_current_provider)"
    [ -n "$current" ] || { error "No se pudo leer el provider actual"; exit 1; }

    if [ -z "$target" ]; then
        case "$current" in
            sqlite)     target="postgresql" ;;
            postgresql) target="sqlite" ;;
            *) error "Provider desconocido: $current"; exit 1 ;;
        esac
    fi

    if [ "$current" = "$target" ]; then
        info "El provider ya es $target; se regenera el schema igualmente"
    fi

    info "Provider actual: $current -> destino: $target"

    backup_migrations

    if [ "$target" = "postgresql" ]; then
        check_postgres "$POSTGRES_URL"
        set_provider "postgresql"
        set_db_url "$POSTGRES_URL"
    else
        set_provider "sqlite"
        set_db_url "$SQLITE_URL"
    fi
    success "schema.prisma y .env actualizados"

    remove_migrations

    # Baseline nuevo para el dialecto destino.
    #
    # Se genera con `migrate diff --from-empty` en vez de `migrate dev` a proposito:
    # `migrate dev` detecta drift cuando la base ya tiene tablas y sin TTY pregunta
    # para resetear, lo que aborta el script con codigo 130. `migrate diff` es
    # determinista y no consulta ni modifica la base, asi que nunca promete nada.
    local migration_dir="$MIGRATIONS_DIR/$(date +%Y%m%d%H%M%S)_init_$target"
    mkdir -p "$migration_dir"

    info "Generando baseline para $target..."
    npx prisma migrate diff \
        --from-empty \
        --to-schema "$SCHEMA_FILE" \
        --script \
        --output "$migration_dir/migration.sql"

    if [ ! -s "$migration_dir/migration.sql" ]; then
        error "El baseline generado esta vacio; se aborta sin tocar la base"
        exit 1
    fi
    success "Baseline creado en $migration_dir"

    printf '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "%s"\n' "$target" >"$MIGRATIONS_DIR/migration_lock.toml"

    # Con el baseline en disco, `reset` aplica en limpio y sin prompts.
    # (migrate reset ya regenera el cliente, por eso no lleva --skip-generate.)
    info "Aplicando schema a la base de datos..."
    npx prisma migrate reset --force

    info "Regenerando cliente Prisma..."
    npx prisma generate

    success "Listo: el proyecto usa $target"
    info "Copia de seguridad de datos: revisa $ROOT/dev.db.bak-* si venias de SQLite"
}

main "$@"