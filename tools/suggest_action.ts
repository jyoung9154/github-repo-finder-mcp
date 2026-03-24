// 액션 제안 Tool
import { SuggestActionResult } from '../types.js';

export interface SuggestActionParams {
  repo: string;
  integration_type: 'fork' | 'package' | 'reference';
}

export async function suggest_action({ repo, integration_type }: SuggestActionParams): Promise<SuggestActionResult> {
  // TODO: 실제 가이드/명령어 생성
  return {
    commands: ['npm install example'],
    guide: 'npm install로 설치하세요.'
  };
}
