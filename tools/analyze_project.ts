// 프로젝트 폴더 분석 Tool
import { ProjectAnalysisResult } from '../types.js';
import fs from 'fs';
import path from 'path';

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

export async function analyze_project({ path }: AnalyzeProjectParams): Promise<ProjectAnalysisResult> {
  const result = await ruleBasedAnalyze(path);
  return {
    stack: result.stack,
    features: result.features,
    gaps: result.gaps,
    dependencies: result.dependencies,
  };
}
