export type SearchParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 20;
export const SORT_OPTIONS = {
  created_at: "Fecha de registro",
  full_name: "Nombre",
  code: "Código",
  paid_amount: "Monto pagado",
  attended_at: "Fecha de ingreso",
} as const;
export type ParticipantQuery = {
  q: string;
  state: "all" | "pending" | "attended";
  sort: keyof typeof SORT_OPTIONS;
  direction: "asc" | "desc";
  page: number;
};

export function parseParticipantQuery(params: SearchParams): ParticipantQuery {
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  return {
    q: typeof params.q === "string" ? params.q.trim().slice(0, 200) : "",
    state: params.state === "pending" || params.state === "attended" ? params.state : "all",
    sort: typeof params.sort === "string" && Object.hasOwn(SORT_OPTIONS, params.sort) ? params.sort as ParticipantQuery["sort"] : "created_at",
    direction: params.direction === "asc" ? "asc" : "desc",
    page: Number.isSafeInteger(page) && page <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ? page : 1,
  };
}

// Use a literal case-insensitive regex: unlike ILIKE, imatch does not rewrite
// a user's * into %. Escape regex syntax, then quote PostgREST's logic grammar.
export function literalSearch(search: string): string {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
  return `full_name.imatch.${quoted},code.imatch.${quoted}`;
}

export function participantHref(query: ParticipantQuery, page = query.page): string {
  const params = new URLSearchParams({
    q: query.q, state: query.state, sort: query.sort, direction: query.direction, page: String(page),
  });
  return `/admin/participants?${params}`;
}
