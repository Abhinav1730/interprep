const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data?.error?.message || res.statusText, res.status, data?.error?.code);
  }
  return data as T;
}

export type KitSummary = {
  id: string;
  status: string;
  title?: string;
  company?: string;
  days: number;
  createdAt: string;
  updatedAt: string;
};

export type Requirement = {
  id: string;
  text: string;
  kind: string;
  priority: "must" | "nice";
};

export type Question = {
  id: string;
  requirement_ids: string[];
  category: string;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  pinned?: boolean;
  edited_fields?: string[];
  origin?: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  pinned?: boolean;
};

export type KitPayload = {
  source: {
    company_url: string;
    pages_used: string[];
    public_discussions: Array<{ url: string; title: string; content: string; type: string }>;
    retrieved_at: string;
  };
  company_brief: {
    name: string;
    summary: string;
    products: string[];
    culture: string;
    engineering: string;
    hiring_process: string;
    hiring_process_found: boolean;
    sources: Array<{ url: string; title?: string }>;
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: Array<{ day: number; focus: string; question_ids: string[]; minutes: number }>;
  };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
};

export type Generation = {
  status: string;
  currentStep: string | null;
  steps: Array<{ id: string; label: string; state: string }>;
  message?: string;
  error?: { code: string; message: string };
};

export type KitRecord = {
  id: string;
  status: string;
  input: { jd: string; companyUrl: string; days: number };
  kit: KitPayload | null;
  generation: Generation;
  error?: { code: string; message: string } | null;
  createdAt?: string;
  updatedAt?: string;
};
