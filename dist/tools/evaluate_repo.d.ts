import { RepoEvaluationResult } from '../types.js';
export interface EvaluateRepoParams {
    repo_url: string;
    project_context: {
        stack: string[];
        needs: string[];
    };
}
export declare function evaluate_repo({ repo_url, project_context }: EvaluateRepoParams): Promise<RepoEvaluationResult>;
//# sourceMappingURL=evaluate_repo.d.ts.map