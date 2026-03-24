// 레포 적합도 평가 Tool
import { RepoEvaluationResult } from '../types';

export interface EvaluateRepoParams {
  repo_url: string;
  project_context: { stack: string[]; needs: string[] };
}

export async function evaluate_repo({ repo_url, project_context }: EvaluateRepoParams): Promise<RepoEvaluationResult> {
  // TODO: 평가 로직 구현
  return {
    score: 80,
    summary: '적합함',
    pros: ['활발한 유지보수'],
    cons: ['문서 부족'],
    integration_type: 'package'
  };
}

