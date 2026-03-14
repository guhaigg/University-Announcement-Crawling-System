# Development Setup (Node 20+)

This project requires Node.js `20+` (recommended: latest LTS).

## 1) Install Node.js

Choose one method for your OS.

### Windows (Recommended: nvm-windows)

1. Install `nvm-windows` from:
   [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Open a new terminal and run:

```powershell
nvm install 20
nvm use 20
node -v
npm -v
```

### macOS (Recommended: Homebrew)

```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
node -v
npm -v
```

Alternative: install via `nvm` if you already use it.

### Linux (Recommended: nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v
npm -v
```

## 2) Install Dependencies

From project root (`D:\codex`):

```bash
npm install
```

## 3) Start in Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 4) Basic Checks

```bash
npm run check
```

## 5) Common Issues

- `npm: command not found`:
  Node.js is not installed or PATH is not updated. Restart terminal after install.
- PowerShell script policy blocks commands:
  run PowerShell as admin once and execute:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

- Port `3000` already in use:
  use a different port:

```powershell
$env:PORT=3001; npm run dev
```

