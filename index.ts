#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { analyze_project } from "./tools/analyze_project.js";
import { search_repos } from "./tools/search_repos.js";

// ── 환경 변수에서 GitHub Token 읽기 ──────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  // process.exit 하지 않음 → MCP 핸드셰이크 완료 후 각 tool에서 개별 처리
  console.error("⚠️  GITHUB_TOKEN이 설정되지 않았습니다. GitHub 검색 기능이 제한됩니다.");
  console.error("   install.sh 를 실행하거나 환경변수 GITHUB_TOKEN 을 설정하세요.");
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
      const analysis = await analyze_project({ path });
      const result = [
        `## 📊 프로젝트 분석 결과`,
        ``,
        // `**프로젝트 유형**: ${analysis.projectType}`,
        // `**설명**: ${analysis.description || "없음"}`,
        `### 🔧 기술 스택`,
        analysis.stack.length > 0 ? analysis.stack.map((s: string) => `- ${s}`).join("\n") : "- (감지 안됨)",
        ``,
        `### ✅ 구현된 기능`,
        analysis.features.length > 0 ? analysis.features.map((f: string) => `- ${f}`).join("\n") : "- (감지된 기능 없음)",
        ``,
        `### ❌ 부족한 부분 (추천 대상)`,
        analysis.gaps.length > 0 ? analysis.gaps.map((g: string) => `- ${g}`).join("\n") : "- (부족한 부분 없음)",
        ``,
        `### 📦 주요 의존성 (${analysis.dependencies.length}개)`,
        analysis.dependencies.slice(0, 10).map((d: string) => `- ${d}`).join("\n"),
        ``,
        analysis.ai_summary ? `### 🤖 AI 요약\n${analysis.ai_summary}` : "",
        analysis.ai_features && analysis.ai_features.length > 0 ? `### 🤖 AI 추출 기능\n${analysis.ai_features.map((f: string) => `- ${f}`).join("\n")}` : "",
        analysis.ai_gaps && analysis.ai_gaps.length > 0 ? `### 🤖 AI 추출 부족한 점\n${analysis.ai_gaps.map((g: string) => `- ${g}`).join("\n")}` : ""
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
    // minStars: z.number().optional().default(50).describe("최소 스타 수"),
  },
  async ({ path }) => {
    try {
      // 1. 프로젝트 분석
      const analysis = await analyze_project({ path });

      const lines: string[] = [
        `## 📊 프로젝트 분석 결과`,
        `- **스택**: ${analysis.stack.join(', ') || '감지 안됨'}`,
        `- **구현된 기능**: ${analysis.features.join(', ') || '없음'}`,
        `- **부족한 부분**: ${analysis.gaps.join(', ') || '없음'}`,
        ``,
      ];

      // 2. gaps 기반으로 GitHub 검색
      if (analysis.gaps.length > 0 && process.env.GITHUB_TOKEN) {
        lines.push(`## 🔎 추천 GitHub 저장소`);
        for (const gap of analysis.gaps.slice(0, 3)) {
          const query = `${analysis.stack[0] || ''} ${gap}`.trim();
          try {
            const repos = await search_repos({ query, filters: { min_stars: 100 } });
            if (repos.length > 0) {
              lines.push(`\n### "${gap}" 관련 추천`);
              repos.slice(0, 3).forEach((r, i) => {
                lines.push(`**${i + 1}. [${r.name}](${r.url})**  ⭐️${r.stars}`);
                lines.push(`> ${r.description}`);
              });
            }
          } catch {
            // 개별 검색 실패는 무시하고 계속
          }
        }
      } else if (!process.env.GITHUB_TOKEN) {
        lines.push(`> ⚠️ GITHUB_TOKEN이 없어 GitHub 검색을 건너뜁니다.`);
      } else {
        lines.push(`> ✅ 부족한 부분이 없습니다!`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
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
    // maxResults: z.number().optional().default(10).describe("최대 결과 수"),
    // sort: z.enum(["stars", "updated", "forks"]).optional().default("stars"),
  },
  async ({ query, language, minStars }) => {
    try {
      const filters: any = {};
      if (minStars) filters.min_stars = minStars;
      if (language) filters.language = language;
      // sort, maxResults는 search_repos에서 직접 사용하지 않으므로, 필요시 확장
      const repos = await search_repos({ query, filters });
      const lines = [
        `## 🔎 "${query}" 검색 결과 — ${repos.length}개`,
        ``,
        ...repos.map((r: any, i: number) => `**${i + 1}. [${r.name}](${r.url})**  ⭐️${r.stars}\n${r.description}`)
      ];
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
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
    if (!GITHUB_TOKEN) {
      return { content: [{ type: "text", text: "❌ GITHUB_TOKEN이 설정되지 않았습니다." }], isError: true };
    }
    try {
      const [owner, repo] = fullName.split("/");
      const octokit = new Octokit({ auth: GITHUB_TOKEN });

      const [repoInfo, readmeRes] = await Promise.allSettled([
        octokit.repos.get({ owner, repo }),
        octokit.repos.getReadme({ owner, repo }),
      ]);

      const info = repoInfo.status === "fulfilled" ? repoInfo.value.data : null;
      let readmeText = "(README 없음)";
      if (readmeRes.status === "fulfilled") {
        readmeText = Buffer.from(readmeRes.value.data.content, "base64").toString("utf-8").slice(0, 3000);
      }

      const result = [
        `## 📖 ${fullName}`,
        info ? `⭐ ${info.stargazers_count} | 🍴 ${info.forks_count} | ${info.language || "언어 미지정"}` : "",
        info ? `> ${info.description || "설명 없음"}` : "",
        ``,
        `**토픽**: ${info?.topics?.join(", ") || "없음"}`,
        `**홈페이지**: ${info?.homepage || "없음"}`,
        `**라이선스**: ${info?.license?.name || "없음"}`,
        ``,
        `### README (앞 3000자)`,
        readmeText,
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
