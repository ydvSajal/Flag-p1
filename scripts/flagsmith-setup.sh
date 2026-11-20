#!/usr/bin/env bash
# Creates PickLab's Flagsmith flags, voting_layout variants, segments and overrides
# using the Flagsmith CLI v2 (see docs/FLAGSMITH-SETUP.md section 2 and 4).
#
# Prereqs: CLI installed, `flagsmith login` done, `flagsmith init` run in the repo
# (writes flagsmith.json), and the host-scoped API key variable set (see below).
# Re-running skips objects that already exist by name.
#
# Usage:
#   FLAGSMITH_API_URL=http://localhost:8000 \
#   FLAGSMITH_API_KEY_localhost_8000=<org API key> \
#   bash scripts/flagsmith-setup.sh
set -euo pipefail

# ---- Editable pre-experiment split for voting_layout (percent). Control (grid) gets the remainder.
SWIPE_WEIGHT=10
THIS_OR_THAT_WEIGHT=0
YES_NO_WEIGHT=0

# ---- Target environment.
ENVIRONMENT="${FLAGSMITH_ENVIRONMENT:-Development}"
# verify: CLI selects the environment from flagsmith.json; if it needs an explicit flag, keep this array and append it to each call.
ENV_ARGS=(--environment "$ENVIRONMENT")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_DIR="$SCRIPT_DIR/flagsmith"

# ---- Required env and host-scoped key convention.
# Host with scheme and path removed; each '-' doubled; '.' and ':' become '_'.
# e.g. https://flagsmith-staging.com:8000 -> FLAGSMITH_API_KEY_flagsmith__staging_com_8000
: "${FLAGSMITH_API_URL:?Set FLAGSMITH_API_URL, e.g. http://localhost:8000}"
host="${FLAGSMITH_API_URL#*://}"
host="${host%%/*}"
key_suffix="$(printf '%s' "$host" | sed -e 's/-/__/g' -e 's/[.:]/_/g')"
key_var="FLAGSMITH_API_KEY_${key_suffix}"
if [ -z "${!key_var:-}" ]; then
  echo "ERROR: ${key_var} is not set. Put the org API key from flagsmith/flagsmith.env there." >&2
  exit 1
fi
export FLAGSMITH_API_URL
# verify: CLI reads ${key_var} by itself from the environment; confirm it does not also need FLAGSMITH_API_KEY.

if ! command -v flagsmith >/dev/null 2>&1; then
  echo "ERROR: flagsmith CLI not found. Install: irm https://raw.githubusercontent.com/Flagsmith/flagsmith-cli/main/install.ps1 | iex" >&2
  exit 1
fi

# Windows CLI needs a Windows path for @file arguments (Git Bash paths like /c/... fail).
to_native() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

# Prints the id of the segment named $1 (empty if none).
segment_id() {
  local out
  out="$(flagsmith segment list --output json "${ENV_ARGS[@]}" 2>/dev/null || true)"
  # verify: `segment list --output json` shape (array or {results: []}) and the `id`/`name` field names.
  printf '%s' "$out" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const want = process.argv[1];
      let a = []; try { a = JSON.parse(s); } catch { return; }
      const list = Array.isArray(a) ? a : (a.results || []);
      const hit = list.find(x => x.name === want);
      if (hit) console.log(hit.id);
    });' "$1"
}

# Prints 0 if feature $1 exists, 1 otherwise.
feature_exists() {
  local out
  out="$(flagsmith feature list "${ENV_ARGS[@]}" 2>/dev/null || true)"
  # verify: `feature list` output format; grep -w on the name is a rough existence check.
  grep -qw -- "$1" <<<"$out"
}

ensure_segment() { # name rules-file -> sets SEG_ID
  local name="$1" file="$2"
  SEG_ID="$(segment_id "$name")"
  if [ -n "$SEG_ID" ]; then
    echo "==> segment $name exists (id $SEG_ID)"
    return
  fi
  echo "==> creating segment $name"
  # verify: `segment create` flags: --name, --rules @file (task spec), --description optional.
  flagsmith segment create --name "$name" --rules "@$(to_native "$file")" "${ENV_ARGS[@]}"
  SEG_ID="$(segment_id "$name")"
  if [ -z "$SEG_ID" ]; then
    echo "ERROR: segment $name not found after create" >&2
    exit 1
  fi
}

ensure_module_flag() { # key json-value
  local key="$1" value="$2"
  if feature_exists "$key"; then
    echo "==> flag $key exists"
    return
  fi
  echo "==> creating flag $key (default OFF)"
  # verify: `feature create` flags: --type (boolean/remote config), --default-enabled, --value.
  flagsmith feature create "$key" --default-enabled false --value "$value" "${ENV_ARGS[@]}"
}

ensure_override() { # segment-id flag-key -> segment override state ON
  echo "==> override ON for segment $1 on $2"
  # verify: `flag update` option that sets the override state (--enabled true) and the segment selector.
  flagsmith flag update "$2" --segment "$1" --enabled true "${ENV_ARGS[@]}"
}

# ---- 1. Segments (rule files live in scripts/flagsmith/).
ensure_segment wave_1 "$RULES_DIR/segment-wave-1.json"
SEG_WAVE_1="$SEG_ID"
ensure_segment wave_2 "$RULES_DIR/segment-wave-2.json"
ensure_segment wave_3 "$RULES_DIR/segment-wave-3.json"
ensure_segment creators "$RULES_DIR/segment-creators.json"
SEG_CREATORS="$SEG_ID"

# ---- 2. Module flags: boolean OFF, JSON remote config string.
MODULE_FLAGS=(module_thumbnails module_captions module_reel_captions module_visuals)
ensure_module_flag module_thumbnails '{"title":"Thumbnails","instructions":"Pick the thumbnail you would click.","sets_per_session":5}'
ensure_module_flag module_captions '{"title":"Captions","instructions":"Pick the caption you would post.","sets_per_session":5}'
ensure_module_flag module_reel_captions '{"title":"Reel captions","instructions":"Pick the caption that fits this reel best.","sets_per_session":5}'
ensure_module_flag module_visuals '{"title":"Visuals","instructions":"Pick the visual you would use for this post.","sets_per_session":5}'

# ---- 3. voting_enabled: global kill switch, ON.
if feature_exists voting_enabled; then
  echo "==> flag voting_enabled exists"
else
  echo "==> creating flag voting_enabled (ON)"
  flagsmith feature create voting_enabled --default-enabled true "${ENV_ARGS[@]}"
fi

# ---- 4. voting_layout: multivariate from the start. Control value = grid.
if feature_exists voting_layout; then
  echo "==> flag voting_layout exists (variants not touched)"
else
  echo "==> creating flag voting_layout (control grid)"
  flagsmith feature create voting_layout --default-enabled true --value grid "${ENV_ARGS[@]}"
  # verify: how a feature becomes multivariate in CLI v2 (adding variants may be enough); `feature variant add` syntax.
  # verify: variant key. The app branches on flag.variant, so each variant key must equal its value (swipe, this_or_that, yes_no).
  flagsmith feature variant add voting_layout --value swipe --weight "$SWIPE_WEIGHT" "${ENV_ARGS[@]}"
  flagsmith feature variant add voting_layout --value this_or_that --weight "$THIS_OR_THAT_WEIGHT" "${ENV_ARGS[@]}"
  flagsmith feature variant add voting_layout --value yes_no --weight "$YES_NO_WEIGHT" "${ENV_ARGS[@]}"
fi

# ---- 5. Overrides.
# creators: ON for every module flag (D3). Seed script runs as a creator.
for flag in "${MODULE_FLAGS[@]}"; do
  ensure_override "$SEG_CREATORS" "$flag"
done
# wave_1: ON for thumbnails and captions only (wave release starts here).
ensure_override "$SEG_WAVE_1" module_thumbnails
ensure_override "$SEG_WAVE_1" module_captions

echo "==> done. Flags, variants, segments and overrides are in place for environment $ENVIRONMENT."
echo "    Experiment voting_layout_v1 is NOT created here: create it in the dashboard (no CLI support)."
