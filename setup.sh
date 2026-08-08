#!/usr/bin/env bash
# Idempotent dependency setup for Client Brain — macOS (Homebrew) and Linux (apt/dnf).
# External deps are deliberately few: git >= 2.40 (commit trailers) and ripgrep.
# Everything else is npm-local.
set -euo pipefail

say()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

SUDO=""
if [ "$(id -u)" -ne 0 ] && have sudo; then SUDO="sudo"; fi

install_pkg() {
  local pkg="$1"
  case "$(uname -s)" in
    Darwin)
      have brew || fail "Homebrew not found. Install it from https://brew.sh then re-run."
      say "brew install $pkg"
      brew list "$pkg" >/dev/null 2>&1 || brew install "$pkg"
      ;;
    Linux)
      if have apt-get; then
        say "apt-get install $pkg"
        $SUDO apt-get update -qq && $SUDO apt-get install -y -qq "$pkg"
      elif have dnf; then
        say "dnf install $pkg"
        $SUDO dnf install -y -q "$pkg"
      else
        fail "No apt-get or dnf found. Install '$pkg' manually and re-run."
      fi
      ;;
    *)
      fail "Unsupported OS: $(uname -s). Install '$pkg' manually and re-run."
      ;;
  esac
}

# --- git >= 2.40 -------------------------------------------------------------
if ! have git; then
  install_pkg git
fi
GIT_VER="$(git --version | sed 's/git version //')"
GIT_MAJOR="${GIT_VER%%.*}"
GIT_MINOR="$(echo "$GIT_VER" | cut -d. -f2)"
if [ "$GIT_MAJOR" -lt 2 ] || { [ "$GIT_MAJOR" -eq 2 ] && [ "$GIT_MINOR" -lt 40 ]; }; then
  say "git $GIT_VER found; >= 2.40 recommended for trailer support. Attempting upgrade…"
  install_pkg git
fi
say "git $(git --version | sed 's/git version //') ✓"

# --- ripgrep -----------------------------------------------------------------
if ! have rg; then
  install_pkg ripgrep
fi
say "ripgrep $(rg --version | head -1 | awk '{print $2}') ✓"

# --- Node >= 20 ---------------------------------------------------------------
if ! have node; then
  fail "Node.js not found. Install Node >= 20 via nvm (https://github.com/nvm-sh/nvm) or fnm, then re-run. An .nvmrc is provided."
fi
NODE_MAJOR="$(node --version | sed 's/v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node $(node --version) found; >= 20 required. Use 'nvm use' (an .nvmrc is provided)."
fi
say "node $(node --version) ✓"

# --- npm install ---------------------------------------------------------------
say "npm install"
npm install --no-fund --no-audit

say "Done. Try: npx vitest run --project unit"
say "For the eval harness, copy .env.example to .env and set ANTHROPIC_API_KEY."
