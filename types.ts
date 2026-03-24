// 공통 타입 정의
export interface ProjectAnalysisResult {
  stack: string[];
  features: string[];
  gaps: string[];
  dependencies: string[];
  // AI 분석 결과(선택)
  ai_summary?: string;
  ai_features?: string[];
  ai_gaps?: string[];
}

export interface RepoSearchResult {
  name: string;
  stars: number;
  description: string;
  url: string;
}

export interface RepoEvaluationResult {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
  integration_type: 'fork' | 'package' | 'reference';
}

export interface SuggestActionResult {
  commands: string[];
  guide: string;
}
