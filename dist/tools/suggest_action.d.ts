import { SuggestActionResult } from '../types.js';
export interface SuggestActionParams {
    repo: string;
    integration_type: 'fork' | 'package' | 'reference';
}
export declare function suggest_action({ repo, integration_type }: SuggestActionParams): Promise<SuggestActionResult>;
//# sourceMappingURL=suggest_action.d.ts.map