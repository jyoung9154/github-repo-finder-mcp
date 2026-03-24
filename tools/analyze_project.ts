// 프로젝트 폴더 분석 Tool
import { ProjectAnalysisResult } from '../types.js';
import fs from 'fs';
import path from 'path';
import { callLLM, run_subagent } from '@modelcontextprotocol/sdk'; // MCP SDK의 LLM 호출 예시

export interface AnalyzeProjectParams {
  path: string;
}

// 룰 기반 분석 함수
async function ruleBasedAnalyze(projectPath: string) {
  let stack: string[] = [], dependencies: string[] = [], features: string[] = [], gaps: string[] = [];
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    stack.push('nodejs');
    if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) stack.push('typescript');
    dependencies = Object.keys(pkg.dependencies || {});
    if (dependencies.includes('express')) features.push('REST API');
    if (dependencies.includes('next')) features.push('SSR/SSG');
    // ...기타 룰 기반 추론
  }
  // Python, Java 등 다른 언어도 확장 가능
  // ...생략...
  return { stack, features, gaps, dependencies };
}

// AI 분석 함수 (MCP 에이전트 활용)
async function aiAnalyzeWithAgent(context: { stack: string[]; features: string[]; dependencies: string[]; }) {
  const prompt = `아래 프로젝트의 주요 기능, 특징, 부족한 점을 요약해줘.\n스택: ${context.stack.join(', ')}\n의존성: ${context.dependencies.join(', ')}\n기능: ${context.features.join(', ')}\n`;
  const aiResult = await run_subagent({
    agentName: "Plan", // 주요 기능 분석에 특화된 MCP 에이전트
    task: prompt
  });
  // aiResult는 { summary, features, gaps } 등으로 가정
  return aiResult;
}

export async function analyze_project({ path }: AnalyzeProjectParams): Promise<ProjectAnalysisResult> {
  // 1. 룰 기반 선행분석
  const ruleResult = await ruleBasedAnalyze(path);
  // 2. AI MCP 에이전트 분석
  const aiResult = await aiAnalyzeWithAgent(ruleResult);
  // 3. 결과 병합
  return {
    ...ruleResult,
    ai_summary: aiResult.summary,
    ai_features: aiResult.features,
    ai_gaps: aiResult.gaps
  };
}
