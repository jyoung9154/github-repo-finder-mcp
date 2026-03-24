# 🔍 github-repo-finder-mcp

> 내 프로젝트를 AI가 분석하고, 필요한 GitHub 저장소를 자동으로 찾아 추천해주는 MCP 서버

---

## 🚀 자동 설치 및 연동 스크립트

최초 설치/설정은 아래 명령어 한 줄로 자동화할 수 있습니다:

```bash
git clone https://github.com/your-username/github-repo-finder-mcp.git
cd github-repo-finder-mcp
bash install.sh
```

실행 후 아래 항목을 순서대로 안내합니다:
1. 사용할 개발환경(IDE) 선택 (VSCode, Claude, Cursor, IntelliJ, Antigravity)
2. GitHub Personal Access Token 입력
3. MCP 서버를 연동할 프로젝트 경로 입력
4. 각 IDE별 설정 파일 자동 추가 및 백업

> 기존 설정 파일이 있으면 자동 백업(.bak) 후 덮어씁니다.

설정이 끝나면 바로 해당 IDE에서 MCP 서버를 사용할 수 있습니다!

---

## 🔑 GitHub Token 발급 및 등록 방법

1. [GitHub Personal Access Token 발급 페이지](https://github.com/settings/tokens) 접속
2. **Generate new token (classic)** 또는 **Fine-grained token** 클릭
3. 권한 선택:
    - 최소 권한: `public_repo`, `read:user`
    - private repo도 검색하려면 `repo` 권한 추가
4. 토큰 생성 후 복사

> ⚠️ **토큰은 외부에 노출되지 않게 주의하세요!**

## 🔑 GitHub Token이란? 왜 필요한가요?

MCP 서버는 GitHub API를 통해 저장소를 검색·분석·추천합니다. 이때 인증된 토큰(GITHUB_TOKEN)이 필요합니다.

- **용도:**
    - 저장소 검색, 상세 정보 조회, 별점/언어/활동성 등 필터링
    - private repo 접근(권한 부여 시)
    - API 요청 제한(ratelimit) 완화
- **보안:** 토큰은 코드에 직접 넣지 않고 환경변수로만 관리됩니다.


--- 


## MCP 표준 지원
- VS Code, Claude Desktop, Cursor, IntelliJ 등과 연동 가능

## 🛠️ 제공 Tools

| Tool | 설명 | 주요 파라미터 |
|------|------|------------|
| `analyze_project` | 프로젝트 폴더 분석 | `path` |
| `find_repos_for_project` | 프로젝트 분석 → 자동 레포 추천 | `path`, `minStars` |
| `search_github_repos` | 직접 키워드로 검색 | `query`, `language`, `minStars` |
| `get_repo_detail` | 저장소 README 상세 조회 | `fullName` |

## 💬 사용 예시

VS Code Copilot Chat에서:

```
@github-repo-finder /my-project 폴더 분석하고 필요한 라이브러리 추천해줘
```

```
react pdf 뷰어 라이브러리 찾아줘 (TypeScript, 스타 500개 이상)
```

```
vercel/next.js 저장소 README 보여줘
```

---
