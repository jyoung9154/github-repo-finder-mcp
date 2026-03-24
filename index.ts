#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeProject } from "./tools/analyze_project.js";
import { searchRepos, generateSearchQueries } from "./tools/search_repos.js";
import { evaluateRepo, suggestAction, getRepoDetail } from "./tools/evaluate_repo.js";

// ── 환경 변수에서 GitHub Token 읽기 ──────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error("❌ 환경 변수 GITHUB_TOKEN이 설정되지 않았습니다.");
  console.error("   export GITHUB_TOKEN=ghp_your_token_here");
  process.exit(1);
}

// ── MCP 서버 초기화 ───────────────────────────────────────────────
const server = new McpServer({
  name: "github-repo-finder",
  version: "1.0.0",
});

// ════════════════════════════════════════════════════════════════
//  TOOL 1: analyze_project
// ════════════════════════════════════════════════════════════════
server.tool(
  "analyze_project",
  "프로젝트 폴더를 분석하여 기술 스택, 의존성, 기능, 부족한 부분을 파악합니다.",
  {
    path: z.string().describe("분석할 프로젝트 폴더 경로 (절대 경로 또는 상대 경로)"),
  },
  async ({ path }) => {
    try {
      const analysis = await analyzeProject(path);

      const result = [
        `## 📊 프로젝트 분석 결과`,
        ``,
        `**프로젝트 유형**: ${analysis.projectType}`,
        `**설명**: ${analysis.description || "없음"}`,
        ``,
        `### 🔧 기술 스택`,
        `- 언어: ${analysis.stack.languages.join(", ") || "감지 안됨"}`,
        `- 프레임워크: ${analysis.stack.frameworks.join(", ") || "없음"}`,
        `- 패키지 매니저: ${analysis.stack.packageManager || "감지 안됨"}`,
        ``,
        `### ✅ 구현된 기능`,
        analysis.features.length > 0
          ? analysis.features.map((f) => `- ${f}`).join("\n")
          : "- (감지된 기능 없음)",
        ``,
        `### ❌ 부족한 부분 (추천 대상)`,
        analysis.gaps.length > 0
          ? analysis.gaps.map((g) => `- ${g}`).join("\n")
          : "- (부족한 부분 없음)",
        ``,
        `### 📦 주요 의존성 (${Object.keys(analysis.dependencies).length}개)`,
        Object.keys(analysis.dependencies)
          .slice(0, 10)
          .map((d) => `- ${d}`)
          .join("\n"),
      ].join("\n");

      return {
        content: [{ type: "text", text: result }],
        metadata: { analysis },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ 분석 실패: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ════════════════════════════════════════════════════════════════
//  TOOL 2: find_repos_for_project
// ════════════════════════════════════════════════════════════════
server.tool(
  "find_repos_for_project",
  "프로젝트 경로를 입력하면 분석 후 관련 GitHub 저장소를 자동으로 찾아 추천합니다.",
  {
    path: z.string().describe("프로젝트 폴더 경로"),
    maxPerQuery: z.number().optional().default(5).describe("쿼리당 최대 결과 수"),
    minStars: z.number().optional().default(50).describe("최소 스타 수"),
  },
  async ({ path, maxPerQuery, minStars }) => {
    try {
      // 1. 프로젝트 분석
      const analysis = await analyzeProject(path);

      // 2. 검색 쿼리 생성
      const queries = generateSearchQueries(analysis);
      if (queries.length === 0) {
        return {
          content: [{ type: "text", text: "⚠️ 검색 쿼리를 생성할 수 없었습니다. 프로젝트를 확인해주세요." }],
        };
      }

      // 3. GitHub 검색
      const allRepos: ReturnType<typeof evaluateRepo>[] = [];
      const seenIds = new Set<number>();

      for (const query of queries) {
        const repos = await searchRepos(GITHUB_TOKEN, {
          ...query,
          minStars: minStars ?? 50,
          maxResults: maxPerQuery ?? 5,
        });

        for (const repo of repos) {
          if (!seenIds.has(repo.id)) {
            seenIds.add(repo.id);
            allRepos.push(evaluateRepo(repo, analysis));
          }
        }
      }

      // 4. 점수 기준 정렬
      allRepos.sort((a, b) => b.score - a.score);
      const top = allRepos.slice(0, 10);

      // 5. 결과 포맷
      const lines = [
        `## 🔍 프로젝트 분석 완료 → ${top.length}개 저장소 추천`,
        ``,
        `**프로젝트**: ${analysis.projectType} | **언어**: ${analysis.stack.languages.join(", ")}`,
        `**부족한 기능**: ${analysis.gaps.join(", ") || "없음"}`,
        ``,
        `---`,
        ``,
      ];

      for (let i = 0; i < top.length; i++) {
        const ev = top[i];
        const action = suggestAction(ev, analysis);
        lines.push(
          `### ${i + 1}. [${ev.repo.fullName}](${ev.repo.url}) — 적합도 ${ev.score}/100`,
          ``,
          `> ${ev.summary}`,
          ``,
          `⭐ ${ev.repo.stars.toLocaleString()} | 🍴 ${ev.repo.forks.toLocaleString()} | 💻 ${ev.repo.language ?? "N/A"} | 📄 ${ev.repo.license ?? "라이선스 없음"}`,
          ``,
          `**👍 장점**: ${ev.pros.join(" · ")}`,
          ev.cons.length > 0 ? `**👎 단점**: ${ev.cons.join(" · ")}` : "",
          ``,
          `**📌 통합 방식**: \`${ev.integrationType}\` — ${ev.reason}`,
          ``,
          `\`\`\`bash`,
          action.commands.join("\n"),
          `\`\`\``,
          ``,
          `---`,
          ``,
        );
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ 실패: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ════════════════════════════════════════════════════════════════
//  TOOL 3: search_github_repos
// ════════════════════════════════════════════════════════════════
server.tool(
  "search_github_repos",
  "직접 쿼리를 입력하여 GitHub 저장소를 검색합니다.",
  {
    query: z.string().describe("검색 키워드 (예: 'react pdf viewer', 'fastapi authentication')"),
    language: z.string().optional().describe("프로그래밍 언어 필터 (예: typescript, python)"),
    minStars: z.number().optional().default(100).describe("최소 스타 수"),
    maxResults: z.number().optional().default(10).describe("최대 결과 수"),
    sort: z.enum(["stars", "updated", "forks"]).optional().default("stars"),
  },
  async ({ query, language, minStars, maxResults, sort }) => {
    try {
      const repos = await searchRepos(GITHUB_TOKEN, {
        query,
        language,
        minStars: minStars ?? 100,
        maxResults: maxResults ?? 10,
        sort: sort ?? "stars",
      });

      const lines = [
        `## 🔎 "${query}" 검색 결과 — ${repos.length}개`,
        ``,
      ];

      for (let i = 0; i < repos.length; i++) {
        const r = repos[i];
        lines.push(
          `**${i + 1}. [${r.fullName}](${r.url})**`,
          `${r.description ?? "설명 없음"}`,
          `⭐ ${r.stars.toLocaleString()} | 🍴 ${r.forks.toLocaleString()} | 💻 ${r.language ?? "N/A"} | 📄 ${r.license ?? "라이선스 없음"}`,
          ``,
        );
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ 검색 실패: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ════════════════════════════════════════════════════════════════
//  TOOL 4: get_repo_detail
// ════════════════════════════════════════════════════════════════
server.tool(
  "get_repo_detail",
  "특정 GitHub 저장소의 README와 상세 정보를 가져옵니다.",
  {
    fullName: z.string().describe("저장소 전체 이름 (예: vercel/next.js)"),
  },
  async ({ fullName }) => {
    try {
      const detail = await getRepoDetail(GITHUB_TOKEN, fullName);
      const result = [
        `## 📖 ${fullName} 상세 정보`,
        ``,
        `**토픽**: ${detail.topics.join(", ") || "없음"}`,
        ``,
        `### README (앞 2000자)`,
        ``,
        detail.readme,
      ].join("\n");

      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `❌ 실패: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ── 서버 시작 ─────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ github-repo-finder MCP 서버가 시작되었습니다.");
