#!/bin/bash

set -e

# 1. IDE 선택
PS3="어떤 개발환경(IDE)에서 MCP 서버를 사용할까요? (번호 선택): "
select ide in "VSCode" "Claude" "Cursor" "IntelliJ" "Antigravity"; do
  case $ide in
    VSCode|Claude|Cursor|IntelliJ|Antigravity)
      break
      ;;
    *)
      echo "잘못된 선택입니다. 다시 시도하세요."
      ;;
  esac
done

# 2. GitHub 토큰 입력 안내
cat <<EOM

────────────────────────────────────────────────────────────
🔑 GitHub Personal Access Token 발급 방법

1. https://github.com/settings/tokens 접속
2. Generate new token (classic) 또는 Fine-grained token 클릭
3. 권한 선택:
   - 최소 권한: public_repo, read:user
   - private repo도 검색하려면 repo 권한 추가
4. 토큰 생성 후 복사

(자세한 안내는 README.md 참고)
────────────────────────────────────────────────────────────

EOM
# 2. GitHub 토큰 입력
read -rsp $'GitHub Personal Access Token을 입력하세요 (입력값 숨김):\n' GITHUB_TOKEN
echo
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "토큰이 입력되지 않았습니다. 종료합니다."; exit 1
fi

# 3. MCP 서버를 사용할 프로젝트 경로 입력
if [[ "$ide" == "VSCode" || "$ide" == "Cursor" ]]; then
  read -rp "MCP 서버를 연동할 프로젝트의 절대경로를 입력하세요: " PROJECT_PATH
  if [[ ! -d "$PROJECT_PATH" ]]; then
    echo "경로가 존재하지 않습니다. 종료합니다."; exit 1
  fi
fi

# 4. MCP 서버 빌드 및 의존성 설치
npm install && npm run build

# 5. IDE별 설정 파일 패치
echo "설정 파일을 자동으로 추가합니다..."
MCP_CMD="node $(pwd)/dist/index.js"
case $ide in
  VSCode)
    SETTINGS_PATH="$PROJECT_PATH/.vscode/settings.json"
    mkdir -p "$PROJECT_PATH/.vscode"
    if [[ -f "$SETTINGS_PATH" ]]; then
      cp "$SETTINGS_PATH" "$SETTINGS_PATH.bak"
    fi
    cat > "$SETTINGS_PATH" <<EOF
{
  "mcp": {
    "servers": {
      "github-repo-finder": {
        "type": "stdio",
        "command": "node",
        "args": ["$MCP_CMD"],
        "env": {
          "GITHUB_TOKEN": "$GITHUB_TOKEN"
        }
      }
    }
  }
}
EOF
    echo "설정 파일이 아래 경로에 추가되었습니다: $SETTINGS_PATH"
    ;;
  Cursor)
    CURSOR_PATH="$PROJECT_PATH/.cursor/mcp.json"
    mkdir -p "$PROJECT_PATH/.cursor"
    cat > "$CURSOR_PATH" <<EOF
{
  "mcpServers": {
    "github-repo-finder": {
      "command": "node",
      "args": ["$MCP_CMD"],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      }
    }
  }
}
EOF
    echo "설정 파일이 아래 경로에 추가되었습니다: $CURSOR_PATH"
    ;;
  Claude)
    CLAUDE_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    mkdir -p "$(dirname "$CLAUDE_PATH")"
    cat > "$CLAUDE_PATH" <<EOF
{
  "mcpServers": {
    "github-repo-finder": {
      "command": "node",
      "args": ["$MCP_CMD"],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      }
    }
  }
}
EOF
    echo "설정 파일이 아래 경로에 추가되었습니다: $CLAUDE_PATH"
    ;;
  "IntelliJ Copilot (JetBrains IDE)")
    # JetBrains 공식 경로에만 MCP 서버 설정 추가 (프로젝트 경로 불필요)
    JETBRAINS_CONFIG="$HOME/.config/github-copilot/intellij/mcp.json"
    mkdir -p "$(dirname \"$JETBRAINS_CONFIG\")"
    if [[ -f "$JETBRAINS_CONFIG" ]]; then
      cp "$JETBRAINS_CONFIG" "$JETBRAINS_CONFIG.bak.$(date +%Y%m%d%H%M%S)"
    fi
    node -e '
const fs = require("fs");
const path = process.argv[1];
const mcpCmd = process.argv[2];
const token = process.argv[3];
let config = { servers: {} };
if (fs.existsSync(path)) {
  try {
    config = JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (e) {
    config = { servers: {} };
  }
}
config.servers = config.servers || {};
config.servers["github-repo-finder"] = {
  type: "stdio",
  command: "node",
  args: [mcpCmd],
  env: { GITHUB_TOKEN: token }
};
fs.writeFileSync(path, JSON.stringify(config, null, 4));
' "$JETBRAINS_CONFIG" "$MCP_CMD" "$GITHUB_TOKEN"
    echo "설정 파일이 아래 경로에 추가되었습니다: $JETBRAINS_CONFIG (기존 파일은 자동 백업됨)"
    ;;
  "Antigravity MCP")
    ANTI_PATH="$HOME/.antigravity/mcp.json"
    mkdir -p "$HOME/.antigravity"
    cat > "$ANTI_PATH" <<EOF
{
  "mcpServers": {
    "github-repo-finder": {
      "command": "node",
      "args": ["$MCP_CMD"],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      }
    }
  }
}
EOF
    echo "설정 파일이 아래 경로에 추가되었습니다: $ANTI_PATH"
    ;;
esac

echo "설정이 완료되었습니다! 위 경로에서 설정 파일을 확인할 수 있습니다. IDE에서 MCP 서버를 바로 사용할 수 있습니다."
