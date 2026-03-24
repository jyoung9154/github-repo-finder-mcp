// GitHub에서 레포 검색 Tool
import { RepoSearchResult } from '../types';

export interface SearchReposParams {
  query: string;
  filters: { min_stars?: number; language?: string; active?: boolean };
}

export async function search_repos({ query, filters }: SearchReposParams): Promise<RepoSearchResult[]> {
  // TODO: Octokit 연동 구현
  return [
    { name: 'example', stars: 123, description: 'desc', url: 'https://github.com/example' }
  ];
}

