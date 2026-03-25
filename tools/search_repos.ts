// GitHub에서 레포 검색 Tool
import { RepoSearchResult } from '../types.js';
import { Octokit } from '@octokit/rest';

export interface SearchReposParams {
  query: string;
  filters: { min_stars?: number; language?: string; active?: boolean };
}

export async function search_repos({ query, filters }: SearchReposParams): Promise<RepoSearchResult[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN이 설정되지 않았습니다. install.sh를 실행하거나 환경변수를 설정하세요.");
  }

  const octokit = new Octokit({ auth: token });

  // 검색 쿼리 조합
  let q = query;
  if (filters.language) q += ` language:${filters.language}`;
  if (filters.min_stars) q += ` stars:>=${filters.min_stars}`;

  const { data } = await octokit.search.repos({
    q,
    sort: 'stars',
    order: 'desc',
    per_page: 10,
  });

  return data.items.map((item) => ({
    name: item.full_name,
    stars: item.stargazers_count,
    description: item.description || '',
    url: item.html_url,
  }));
}
