import fs from 'fs';
import path from 'path';
// 룰 기반 분석 함수
async function ruleBasedAnalyze(projectPath) {
    let stack = [], dependencies = [], features = [], gaps = [];
    // ── Node.js / TypeScript ──────────────────────────────────────
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        stack.push('nodejs');
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        dependencies = Object.keys(pkg.dependencies || {});
        if (allDeps.typescript)
            stack.push('typescript');
        if (allDeps.react) {
            stack.push('react');
            features.push('React UI');
        }
        if (allDeps['react-dom'])
            features.push('DOM 렌더링');
        if (allDeps.next) {
            stack.push('next.js');
            features.push('SSR/SSG');
        }
        if (allDeps.express) {
            stack.push('express');
            features.push('REST API (Express)');
        }
        if (allDeps.fastify) {
            stack.push('fastify');
            features.push('REST API (Fastify)');
        }
        if (allDeps.graphql || allDeps['@apollo/server'])
            features.push('GraphQL API');
        if (allDeps.prisma || allDeps['@prisma/client']) {
            stack.push('prisma');
            features.push('ORM (Prisma)');
        }
        if (allDeps.mongoose)
            features.push('ORM (Mongoose/MongoDB)');
        if (allDeps.sequelize)
            features.push('ORM (Sequelize)');
        if (allDeps.typeorm)
            features.push('ORM (TypeORM)');
        if (allDeps.jest || allDeps.vitest || allDeps.mocha)
            features.push('테스트');
        if (allDeps.tailwindcss)
            features.push('Tailwind CSS');
        if (allDeps.socket || allDeps['socket.io'])
            features.push('WebSocket');
        if (allDeps['@modelcontextprotocol/sdk']) {
            stack.push('mcp');
            features.push('MCP 서버');
        }
        if (allDeps['@octokit/rest'] || allDeps.octokit)
            features.push('GitHub API');
        // 갭 분석
        const hasAuth = !!(allDeps['next-auth'] || allDeps.passport || allDeps['@auth/core'] || allDeps.jsonwebtoken);
        const hasLogger = !!(allDeps.winston || allDeps.pino || allDeps.bunyan);
        const hasValidation = !!(allDeps.zod || allDeps.joi || allDeps.yup);
        const hasTest = !!(allDeps.jest || allDeps.vitest || allDeps.mocha || allDeps.playwright || allDeps.cypress);
        const hasDocs = !!(allDeps.swagger || allDeps['@nestjs/swagger'] || allDeps['fastify-swagger']);
        const hasI18n = !!(allDeps['i18next'] || allDeps['next-i18next']);
        const hasCache = !!(allDeps.redis || allDeps['ioredis'] || allDeps['node-cache']);
        if (!hasAuth)
            gaps.push('인증/인가 (Auth)');
        if (!hasLogger)
            gaps.push('로깅 (Logger)');
        if (!hasValidation)
            gaps.push('데이터 검증 (Validation)');
        if (!hasTest)
            gaps.push('테스트 프레임워크');
        if (!hasDocs)
            gaps.push('API 문서화 (Swagger 등)');
        if (!hasI18n)
            gaps.push('다국어 지원 (i18n)');
        if (!hasCache)
            gaps.push('캐싱 (Redis 등)');
    }
    // ── Python ───────────────────────────────────────────────────
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');
    if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath) ||
        fs.existsSync(path.join(projectPath, 'setup.py'))) {
        stack.push('python');
        if (fs.existsSync(requirementsPath)) {
            const reqs = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase();
            if (reqs.includes('django')) {
                stack.push('django');
                features.push('Django 웹 프레임워크');
            }
            if (reqs.includes('flask')) {
                stack.push('flask');
                features.push('Flask REST API');
            }
            if (reqs.includes('fastapi')) {
                stack.push('fastapi');
                features.push('FastAPI REST API');
            }
            if (reqs.includes('sqlalchemy'))
                features.push('ORM (SQLAlchemy)');
            if (reqs.includes('pytest'))
                features.push('테스트 (pytest)');
            if (reqs.includes('celery'))
                features.push('비동기 태스크 (Celery)');
            if (reqs.includes('redis'))
                features.push('캐싱 (Redis)');
            if (reqs.includes('pandas'))
                features.push('데이터 분석 (Pandas)');
            if (reqs.includes('numpy'))
                features.push('수치 계산 (NumPy)');
            if (reqs.includes('openai') || reqs.includes('langchain'))
                features.push('AI/LLM 연동');
            dependencies = fs.readFileSync(requirementsPath, 'utf-8')
                .split('\n').map(l => l.split('==')[0].split('>=')[0].trim()).filter(Boolean);
        }
    }
    // ── Java / Kotlin ─────────────────────────────────────────────
    const pomPath = path.join(projectPath, 'pom.xml');
    const gradlePath = path.join(projectPath, 'build.gradle');
    const gradleKtsPath = path.join(projectPath, 'build.gradle.kts');
    if (fs.existsSync(pomPath) || fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath)) {
        const buildFile = fs.existsSync(pomPath) ? fs.readFileSync(pomPath, 'utf-8')
            : fs.existsSync(gradleKtsPath) ? fs.readFileSync(gradleKtsPath, 'utf-8')
                : fs.readFileSync(gradlePath, 'utf-8');
        const isKotlin = fs.existsSync(gradleKtsPath) || buildFile.includes('kotlin');
        stack.push(isKotlin ? 'kotlin' : 'java');
        if (buildFile.includes('spring-boot')) {
            stack.push('spring-boot');
            features.push('Spring Boot');
        }
        if (buildFile.includes('spring-security'))
            features.push('인증/인가 (Spring Security)');
        if (buildFile.includes('jpa') || buildFile.includes('hibernate'))
            features.push('ORM (JPA/Hibernate)');
        if (buildFile.includes('junit'))
            features.push('테스트 (JUnit)');
        if (buildFile.includes('lombok'))
            features.push('Lombok');
    }
    // ── Go ────────────────────────────────────────────────────────
    const goModPath = path.join(projectPath, 'go.mod');
    if (fs.existsSync(goModPath)) {
        stack.push('go');
        const goMod = fs.readFileSync(goModPath, 'utf-8');
        if (goMod.includes('gin-gonic/gin')) {
            stack.push('gin');
            features.push('REST API (Gin)');
        }
        if (goMod.includes('labstack/echo'))
            features.push('REST API (Echo)');
        if (goMod.includes('gorm.io'))
            features.push('ORM (GORM)');
        if (goMod.includes('gofiber/fiber'))
            features.push('REST API (Fiber)');
    }
    // ── Rust ──────────────────────────────────────────────────────
    const cargoPath = path.join(projectPath, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
        stack.push('rust');
        const cargo = fs.readFileSync(cargoPath, 'utf-8');
        if (cargo.includes('actix-web'))
            features.push('REST API (Actix-web)');
        if (cargo.includes('axum'))
            features.push('REST API (Axum)');
        if (cargo.includes('tokio'))
            features.push('비동기 런타임 (Tokio)');
    }
    // ── 공통 인프라 파일 ─────────────────────────────────────────
    if (fs.existsSync(path.join(projectPath, 'Dockerfile')))
        features.push('Docker');
    if (fs.existsSync(path.join(projectPath, 'docker-compose.yml')) ||
        fs.existsSync(path.join(projectPath, 'docker-compose.yaml')))
        features.push('Docker Compose');
    if (fs.existsSync(path.join(projectPath, '.github', 'workflows')))
        features.push('CI/CD (GitHub Actions)');
    // 중복 제거
    stack = [...new Set(stack)];
    features = [...new Set(features)];
    gaps = [...new Set(gaps)];
    return { stack, features, gaps, dependencies };
}
export async function analyze_project({ path: projectPath }) {
    const result = await ruleBasedAnalyze(projectPath);
    return {
        stack: result.stack,
        features: result.features,
        gaps: result.gaps,
        dependencies: result.dependencies,
    };
}
//# sourceMappingURL=analyze_project.js.map