#!/bin/bash

set -e

# ────────────────────────────────────────────────
# Node.js 절대 경로 확인 (nvm, brew 등 모두 대응)
# ────────────────────────────────────────────────
NODE_BIN=$(which node 2>/dev/null || true)
if [[ -z "$NODE_BIN" ]]; then
  for candidate in \
    "$HOME/.nvm/versions/node"/*/bin/node \
    /usr/local/bin/node \
    /opt/homebrew/bin/node \
    /usr/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치 후 다시 시도하세요."
  exit 1
fi
NODE_BIN=$(readlink -f "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")
echo "Node.js 경로 감지: $NODE_BIN ($("$NODE_BIN" --version))"

# ────────────────────────────────────────────────
# 1. IDE 선택
# ────────────────────────────────────────────────
echo ""
echo "어떤 개발환경(IDE)에서 MCP 서버를 사용할까요?"
echo "  1) VSCode"
echo "  2) Claude Desktop"
echo "  3) Cursor"
echo "  4) IntelliJ (GitHub Copilot 플러그인)"
echo "  5) Antigravity"
echo ""
read -rp "번호를 입력하세요 (1-5): " IDE_NUM

case "$IDE_NUM" in
  1) ide="VSCode" ;;
  2) ide="Claude" ;;
  3) ide="Cursor" ;;
  4) ide="IntelliJ" ;;
  5) ide="Antigravity" ;;
  *)
    echo "잘못된 선택입니다. 1~5 중에서 입력해주세요."
    exit 1
    ;;
esac
echo "선택된 환경: $ide"

# ────────────────────────────────────────────────
# 2. GitHub 토큰 입력 안내
# ────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  GitHub Personal Access Token 발급 방법"
echo "============================================================"
echo ""
echo "  1. https://github.com/settings/tokens 접속"
echo "  2. 'Generate new token (classic)' 또는"
echo "     'Fine-grained token' 클릭"
echo "  3. 권한 선택:"
echo "       - 최소 권한: public_repo, read:user"
echo "       - private repo 검색: repo 권한 추가"
echo "  4. 토큰 생성 후 복사"
echo ""
echo "============================================================"
echo ""

# ────────────────────────────────────────────────
# 3. GitHub 토큰 입력
# ────────────────────────────────────────────────
read -rsp "GitHub Personal Access Token을 입력하세요 (입력값 숨김): " GITHUB_TOKEN
echo ""
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "토큰이 입력되지 않았습니다. 종료합니다."; exit 1
fi
echo "토큰 입력 완료"

# ────────────────────────────────────────────────
# 4. VSCode/Cursor는 프로젝트 경로 필요
# ────────────────────────────────────────────────
if [[ "$ide" == "VSCode" || "$ide" == "Cursor" ]]; then
  echo ""
  read -rp "MCP 서버를 연동할 프로젝트의 절대경로를 입력하세요: " PROJECT_PATH
  if [[ ! -d "$PROJECT_PATH" ]]; then
    echo "경로가 존재하지 않습니다: $PROJECT_PATH"
    exit 1
  fi
  echo "프로젝트 경로: $PROJECT_PATH"
fi

# 5. MCP 서버 빌드 및 의존성 설치
echo ""
echo "의존성 설치 및 빌드 중..."
npm install
npm run build
echo "빌드 완료"

# 6. IDE별 설정 파일 생성/병합
echo ""
echo "설정 파일을 자동으로 추가합니다..."
MCP_SERVER_PATH="$(pwd)/dist/index.js"

case $ide in
  VSCode)
    SETTINGS_PATH="$PROJECT_PATH/.vscode/settings.json"
    mkdir -p "$PROJECT_PATH/.vscode"
    if [[ -f "$SETTINGS_PATH" ]]; then
      cp "$SETTINGS_PATH" "$SETTINGS_PATH.bak.$(date +%Y%m%d%H%M%S)"
    fi
    "$NODE_BIN" -e '
const fs = require("fs");
const settingsPath = process.argv[1];
const mcpPath = process.argv[2];
const token = process.argv[3];
const nodeBin = process.argv[4];
let config = {};
if (fs.existsSync(settingsPath)) {
  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    const cleaned = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
    config = JSON.parse(cleaned);
  } catch(e) { config = {}; }
}
if (!config.mcp) config.mcp = {};
if (!config.mcp.servers) config.mcp.servers = {};
config.mcp.servers["github-repo-finder"] = {
  type: "stdio",
  command: nodeBin,
  args: [mcpPath],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2));
' "$SETTINGS_PATH" "$MCP_SERVER_PATH" "$GITHUB_TOKEN" "$NODE_BIN"
    echo "설정 파일이 아래 경로에 추가되었습니다:"
    echo "  $SETTINGS_PATH"
    ;;

  Cursor)
    CURSOR_PATH="$PROJECT_PATH/.cursor/mcp.json"
    mkdir -p "$PROJECT_PATH/.cursor"
    if [[ -f "$CURSOR_PATH" ]]; then
      cp "$CURSOR_PATH" "$CURSOR_PATH.bak.$(date +%Y%m%d%H%M%S)"
    fi
    "$NODE_BIN" -e '
const fs = require("fs");
const filePath = process.argv[1];
const mcpPath = process.argv[2];
const token = process.argv[3];
const nodeBin = process.argv[4];
let config = { mcpServers: {} };
if (fs.existsSync(filePath)) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
    config = JSON.parse(cleaned) || { mcpServers: {} };
  } catch(e) { config = { mcpServers: {} }; }
}
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers["github-repo-finder"] = {
  command: nodeBin,
  args: [mcpPath],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
' "$CURSOR_PATH" "$MCP_SERVER_PATH" "$GITHUB_TOKEN" "$NODE_BIN"
    echo "설정 파일이 아래 경로에 추가되었습니다:"
    echo "  $CURSOR_PATH"
    ;;

  Claude)
    CLAUDE_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    mkdir -p "$(dirname "$CLAUDE_PATH")"
    if [[ -f "$CLAUDE_PATH" ]]; then
      cp "$CLAUDE_PATH" "$CLAUDE_PATH.bak.$(date +%Y%m%d%H%M%S)"
    fi
    "$NODE_BIN" -e '
const fs = require("fs");
const filePath = process.argv[1];
const mcpPath = process.argv[2];
const token = process.argv[3];
const nodeBin = process.argv[4];
let config = {};
if (fs.existsSync(filePath)) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
    config = JSON.parse(cleaned);
  } catch(e) { config = {}; }
}
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers["github-repo-finder"] = {
  command: nodeBin,
  args: [mcpPath],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
' "$CLAUDE_PATH" "$MCP_SERVER_PATH" "$GITHUB_TOKEN" "$NODE_BIN"
    echo "설정 파일이 아래 경로에 추가되었습니다:"
    echo "  $CLAUDE_PATH (기존 파일은 자동 백업됨)"
    ;;

  IntelliJ)
    JETBRAINS_CONFIG="$HOME/.config/github-copilot/intellij/mcp.json"
    mkdir -p "$(dirname "$JETBRAINS_CONFIG")"
    if [[ -f "$JETBRAINS_CONFIG" ]]; then
      cp "$JETBRAINS_CONFIG" "$JETBRAINS_CONFIG.bak.$(date +%Y%m%d%H%M%S)"
    fi
    "$NODE_BIN" -e '
const fs = require("fs");
const filePath = process.argv[1];
const mcpPath = process.argv[2];
const token = process.argv[3];
const nodeBin = process.argv[4];
let config = { servers: {} };
if (fs.existsSync(filePath)) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
    config = JSON.parse(cleaned) || { servers: {} };
  } catch(e) {
    config = { servers: {} };
  }
}
if (!config.servers) config.servers = {};
config.servers["github-repo-finder"] = {
  type: "stdio",
  command: nodeBin,
  args: [mcpPath],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(filePath, JSON.stringify(config, null, 4));
' "$JETBRAINS_CONFIG" "$MCP_SERVER_PATH" "$GITHUB_TOKEN" "$NODE_BIN"
    echo "설정 파일이 아래 경로에 추가되었습니다:"
    echo "  $JETBRAINS_CONFIG (기존 파일은 자동 백업됨)"
    ;;

  Antigravity)
    ANTI_PATH="$HOME/.antigravity/mcp.json"
    mkdir -p "$HOME/.antigravity"
    if [[ -f "$ANTI_PATH" ]]; then
      cp "$ANTI_PATH" "$ANTI_PATH.bak.$(date +%Y%m%d%H%M%S)"
    fi
    "$NODE_BIN" -e '
const fs = require("fs");
const filePath = process.argv[1];
const mcpPath = process.argv[2];
const token = process.argv[3];
const nodeBin = process.argv[4];
let config = { mcpServers: {} };
if (fs.existsSync(filePath)) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
    config = JSON.parse(cleaned) || { mcpServers: {} };
  } catch(e) { config = { mcpServers: {} }; }
}
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers["github-repo-finder"] = {
  command: nodeBin,
  args: [mcpPath],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
' "$ANTI_PATH" "$MCP_SERVER_PATH" "$GITHUB_TOKEN" "$NODE_BIN"
    echo "설정 파일이 아래 경로에 추가되었습니다:"
    echo "  $ANTI_PATH"
    ;;
esac

echo ""
echo "============================================================"
echo "  설치 완료! IDE를 완전히 종료 후 재시작하세요."
echo "============================================================"
echo ""

case $ide in
  VSCode)
    echo "  [VSCode 사용법] Copilot Chat -> Agent 모드 전환 후:"
    echo "    @github-repo-finder 현재 프로젝트 분석해줘"
    echo "    react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)"
    echo "    vercel/next.js 저장소 README 보여줘"
    ;;
  Claude)
    echo "  [Claude Desktop 사용법] 대화창에서 바로 입력:"
    echo "    현재 프로젝트 폴더를 분석하고 필요한 라이브러리 추천해줘"
    echo "    react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)"
    echo "    vercel/next.js 저장소 README 보여줘"
    ;;
  Cursor)
    echo "  [Cursor 사용법] Cursor Chat -> Agent 모드 전환 후:"
    echo "    @github-repo-finder 현재 프로젝트 분석해줘"
    echo "    react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)"
    echo "    vercel/next.js 저장소 README 보여줘"
    ;;
  IntelliJ)
    echo "  [IntelliJ Copilot 사용법]"
    echo "  Copilot Chat 패널 -> 'Agent' 모드 전환 후 자연어로 입력:"
    echo "    현재 프로젝트 폴더 분석하고 필요한 라이브러리 추천해줘"
    echo "    react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)"
    echo "    vercel/next.js 저장소 README 보여줘"
    echo ""
    echo "  [MCP 서버 상태 확인]"
    echo "  Settings > GitHub Copilot > MCP Servers 에서"
    echo "  'github-repo-finder' 서버가 Running 상태인지 확인하세요."
    ;;
  Antigravity)
    echo "  [Antigravity 사용법] 채팅창에서 바로 입력:"
    echo "    현재 프로젝트 폴더 분석하고 필요한 라이브러리 추천해줘"
    echo "    react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)"
    echo "    vercel/next.js 저장소 README 보여줘"
    ;;
esac

echo ""
echo "============================================================"
