#!/bin/bash

set -e

# 1. IDE 선택
PS3="어떤 개발환경(IDE)에서 MCP 서버를 사용할까요? (번호 선택): "
select ide in "VSCode" "Claude" "Cursor"; do
  case $ide in
    VSCode|Claude|Cursor)
      break
      ;;
    *)
      echo "잘못된 선택입니다. 다시 시도하세요."
      ;;
  esac
done

# 2. GitHub 토큰 입력
read -rsp $'GitHub Personal Access Token을 입력하세요 (입력값 숨김):\n' GITHUB_TOKEN
echo
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "토큰이 입력되지 않았습니다. 종료합니다."; exit 1
fi

# 3. MCP 서버를 사용할 프로젝트 경로 입력
read -rp "MCP 서버를 연동할 프로젝트의 절대경로를 입력하세요: " PROJECT_PATH
if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "경로가 존재하지 않습니다. 종료합니다."; exit 1
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
    ;;
esac

echo "설정이 완료되었습니다! $ide에서 MCP 서버를 바로 사용할 수 있습니다."

