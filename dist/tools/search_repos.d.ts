import { RepoSearchResult } from '../types.js';
export interface SearchReposParams {
    query: string;
    filters: {
        min_stars?: number;
        language?: string;
        active?: boolean;
    };
}
export declare function search_repos({ query, filters }: SearchReposParams): Promise<RepoSearchResult[]>;
//# sourceMappingURL=search_repos.d.ts.map