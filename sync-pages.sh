#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_file="$repo_root/writing_app/templates/index.html"
pages_file="$repo_root/docs/index.html"
source_static_dir="$repo_root/writing_app/static"
pages_static_dir="$repo_root/docs/static"

mkdir -p "$(dirname "$pages_file")"
cp "$source_file" "$pages_file"
mkdir -p "$pages_static_dir"
cp -R "$source_static_dir/." "$pages_static_dir"

printf 'Synced %s -> %s\n' "$source_file" "$pages_file"
printf 'Synced %s -> %s\n' "$source_static_dir" "$pages_static_dir"
