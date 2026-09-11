# Interprep — AI Interview Prep Kit

An interview prep kit generator. A user pastes a job description, a company website URL, and the number of days until the interview. The system researches the company, extracts requirements, generates questions and flashcards by category, checks coverage in code, fills gaps, then builds a deterministic study schedule. The kit is editable. Practice tracks confidence.

This is not a single LLM prompt. Language understanding lives in the model. Coverage, scheduling, IDs, validation, URL safety, and edit preservation live in application code.

## Architecture

```
Web (Next.js)
   → Express API
        → generateKit()
             ├── retrieval (robots.txt, ranked crawl, public discussion)
             ├── LLM router (NVIDIA NIM Lightning + OpenRouter Super)
             ├── coverage checker (set math)
             └── scheduler (deterministic)
        → MongoDB
```

`POST /kits` and `npm run evaluate` both call the same `generateKit()` function in `packages/pipeline`.

### Packages

| Package | Responsibility |
|---|---|
| `packages/shared` | Appendix A Zod schema, coverage, schedule, hashes, edit merge |
| `packages/retrieval` | robots.txt, SSRF policy, HTML extract, link ranking, public search |
| `packages/llm` | NVIDIA NIM + OpenRouter adapters, retries, JSON repair |
| `packages/pipeline` | sequenced generation |
| `apps/api` | auth, kit CRUD, evaluate CLI |
| `apps/web` | builder, practice, weak spots |

## Why these technologies

- **TypeScript + Zod** — LLM output is untrusted. The kit is rejected unless it matches the contract and semantic ID graph.
- **Express + MongoDB** — matches the preferred stack; one kit document is the source of truth.
- **Next.js** — App Router for the workspace UI.
- **Two LLM providers** — free-tier rate limits are real. Task routing plus cross-provider fallback is more robust than one model.

## LLM routing

| Task | Primary | Fallback |
|---|---|---|
| Requirement extraction, company extraction, gap questions, flashcards, JSON repair | NVIDIA NIM `nvidia/nemotron-3.5-lightning-30b-a3b` | OpenRouter Super |
| Technical, behavioural, system-design, company-fit questions | OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` (JSON schema) | NVIDIA Lightning |
| Coverage, schedule, IDs, validation | **No LLM** | — |

Nemotron 3 Ultra is not the default. It is slow, less available, and does not enforce `response_format`. Super supports structured JSON and is fast enough for the 5-case / 15-minute budget.

NVIDIA thinking is disabled for JSON calls. Temperature is low for extraction and higher for question writing.

OpenRouter free-model accounts are capped (20 rpm, 50 requests/day until the account has purchased at least $10 in credits). Failed retries count. NVIDIA handles volume; Super is reserved for the four question categories. Pin model IDs in env. Do not use `openrouter/free`.

## Retrieval

The crawler does **not** only hit `/careers` and `/about`.

1. Fetch the homepage.
2. Honor `robots.txt`.
3. Extract links, score them (careers/hiring/interview +10, handbook +8, engineering +6, about/team +5, blog +3, pricing +1).
4. Fetch the highest-scoring in-domain pages.
5. Take **one extra hop** from those pages so a handbook linked only from careers can still be found.
6. Stay on the company host. Cap pages, bytes, time, and content types (`text/html`, `xhtml`, `text/plain`).

Relative URLs are resolved with the WHATWG `URL` API so `http://localhost:8099/acme/` + `careers` becomes `http://localhost:8099/acme/careers`.

**URL policy:** production rejects loopback and private addresses (SSRF), including hostnames that resolve to private IPs (DNS rebinding guard). Evaluation and local development set `ALLOW_PRIVATE_URLS=true` / `EVALUATION_MODE=true` so the batch evaluator’s localhost fixtures work. Crawl requests are rate-limited (~350ms between pages) and retried with backoff on transient failures.

Public interview discussion is a **separate** source (`type: "public_discussion"`). It is supporting evidence, never treated as ground truth.

Job descriptions are pasted text. LinkedIn/Indeed are not scraped.

### Sources used

- Company website pages listed in `source.pages_used` and `company_brief.sources`
- Public HTML search snippets stored in `source.public_discussions`

Crawled text and the JD are wrapped as **untrusted data**. Prompts forbid following instructions inside that material.

## Generation sequence

1. Validate input and hash JD + canonical company URL (duplicate reuse per user).
2. Extract requirements from the JD **in parallel** with the crawl.
3. Summarize company research. If no hiring page exists, the brief says so and the case stays `ok`.
4. Generate technical, behavioural, system-design, and company-fit questions in **separate** calls.
5. Deterministic coverage. Uncovered must-haves trigger up to 3 passes, then template fallback questions so a kit does not ship with uncovered must-haves.
6. Flashcards linked to requirement IDs.
7. Deterministic schedule: exactly N days (including 1 and 60), harder / must-have material earlier.
8. Zod + semantic validation, then save.

Thin JDs produce few requirements. Inventing a stack is worse than a short list. Missing hiring process is an honest gap, not a failed case. A case fails only when a valid kit cannot be produced.

## Coverage and schedule

Coverage is set arithmetic over `question.requirement_ids`. The model is not asked whether coverage is complete.

Schedule score = `difficulty * 10 + must * 20 + categoryWeight`. Days are numbered `1..N`. Minutes are integers. Every question appears at least once. If there are more days than questions, later days are review cycles.

## Builder state

Each question and flashcard stores `generated` vs current fields, `edited_fields`, `pinned`, and `origin`. Regenerating a section keeps edited, pinned, and user-created items and replaces the rest. Reorder is optimistic in the UI, then `PATCH /kits/:id/questions/reorder`. The company brief is editable inline in the UI. Batch kit creation accepts a JSON file of `{ jd, company_url, days }` cases on the New kit page.

## Practice and weak spots

Practice is one card at a time: reveal, then confidence 1–5. The next session orders low confidence first, then never-practiced cards. Full spaced repetition was skipped because the spec allows a simpler confidence-weighted strategy.

The creative feature is a **Weak Spots** report derived from requirements, flashcards, and confidence — not a second product.

## API

- `POST/GET /auth/register|login|logout|me`
- `POST/GET/PATCH/DELETE /kits`
- `GET /kits/:id/progress`
- `POST /kits/:id/regenerate/{company,technical,behavioural,system-design,company-fit,flashcards,schedule}`
- question add / edit / delete / reorder / move-category
- flashcard add / edit / delete
- `GET/POST /kits/:id/practice`

`POST /kits` returns immediately with `status=generating`. The UI polls every 1.5s.

Sessions are httpOnly cookies backed by a `sessions` collection (token hash + expiry). Users only see their own kits.

## Setup

```bash
cp .env.example .env
# set MONGODB_URI, NVIDIA_API_KEY, OPENROUTER_API_KEY, SESSION_SECRET
npm install
npm run dev
```

Web: http://localhost:3000  
API: http://localhost:4000

### Tests

```bash
npm test
```

Covers schedule allocation for 1 / 5 / 60 days, coverage set math, and schema rejection of invalid kits.

### Batch evaluation (exact command)

```bash
npm run evaluate -- --input samples/cases.example.json --output kits.json
```

Each case is isolated. A failure does not stop the rest. Concurrency is capped (2 cases, LLM calls serialized inside the router). The CLI sets `EVALUATION_MODE=true` so localhost company URLs are allowed.

Local fixture (optional):

```bash
npx --yes serve samples/acme -p 8099
```

Then use `http://localhost:8099/` as `company_url`.

## Environment

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas or local Mongo |
| `NVIDIA_API_KEY` | NIM key (`nvapi-…`) |
| `NVIDIA_MODEL` | default Lightning |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `OPENROUTER_MODEL` | pinned Super free model |
| `SESSION_SECRET` | unused by cookie id sessions; keep for future signing |
| `FRONTEND_URL` | CORS origin |
| `NEXT_PUBLIC_API_URL` | browser API base |
| `ALLOW_PRIVATE_URLS` | allow localhost crawl |
| `EVALUATION_MODE` | set by the CLI |

Never commit real keys.

## Deployment

- Frontend: Vercel (`apps/web`), set `NEXT_PUBLIC_API_URL` to the public API.
- API: Render / Railway, start `npm run start -w @interprep/api`.
- Database: MongoDB Atlas.
- Production: `NODE_ENV=production`, `ALLOW_PRIVATE_URLS=false`. The evaluate command still forces localhost allowance when you run it locally.

## Limitations

- Free LLM endpoints rate-limit. Backoff and fallback reduce but do not eliminate 429s.
- Public discussion search depends on DuckDuckGo HTML and may return nothing; the kit still generates.
- Company research is bounded (8 pages, 2 hops). Unusual IA can still be missed; ranking is a heuristic, not an allowlist.
- 60-day schedules repeat review items after questions run out.

## Walkthrough

See [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) for a 3–4 minute demo script.
