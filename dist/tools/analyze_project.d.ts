import { ProjectAnalysisResult } from '../types.js';
export interface AnalyzeProjectParams {
    path: string;
}
export declare function analyze_project({ path: projectPath }: AnalyzeProjectParams): Promise<ProjectAnalysisResult>;
//# sourceMappingURL=analyze_project.d.ts.map