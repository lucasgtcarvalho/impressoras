export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const page = params.page || 1;
  const limit = params.limit || 50;
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function getPaginationQuery(params: PaginationParams): {
  skip: number;
  take: number;
} {
  const page = params.page || 1;
  const limit = Math.min(params.limit || 50, 100);
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
