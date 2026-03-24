#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyze_project } from "./tools/analyze_project.js";
import { search_repos } from "./tools/search_repos.js";
// generateSearchQueries, suggestAction, getRepoDetail 등은 미구현이므로 주석 처리

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
      // 2. 검색 쿼리 생성 및 3. GitHub 검색 등은 미구현이므로 생략
      const lines = [
        `## 🔍 프로젝트 분석 완료 → 저장소 추천은 미구현입니다.`,
        ``,
        `**부족한 기능**: ${analysis.gaps.join(", ") || "없음"}`,
        ``,
        `---`,
        ``,
      ];
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
    try {
      // const detail = await getRepoDetail(GITHUB_TOKEN, fullName);
      const detail = { topics: [], readme: "(미구현)" };
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
