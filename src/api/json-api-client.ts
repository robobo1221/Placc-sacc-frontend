export type RequestOptions = Omit<RequestInit, 'body' | 'method'>

type JsonRequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

const toSnakeCaseKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()

const toCamelCaseKey = (key: string) =>
  key.replace(/_+([a-zA-Z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  )

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const transformKeys = (
  value: unknown,
  transformKey: (key: string) => string,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeys(item, transformKey))
  }

  if (!isPlainObject(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      transformKey(key),
      transformKeys(item, transformKey),
    ]),
  )
}

export const toSnakeCase = <T>(value: T): T =>
  transformKeys(value, toSnakeCaseKey) as T

export const toCamelCase = <T>(value: T): T =>
  transformKeys(value, toCamelCaseKey) as T

/**
 * Base client for JSON APIs that use snake_case over the wire and camelCase in
 * TypeScript. Extend this class for each backend API client.
 */
export class JsonApiClient {
  protected constructor(private readonly baseUrl: string) {}

  protected get<T>(
    path: string,
    query: Record<string, boolean | number | string | undefined>,
    options?: RequestOptions,
  ) {
    const search = new URLSearchParams()

    for (const [key, value] of Object.entries(toSnakeCase(query))) {
      if (value !== undefined) {
        search.set(key, String(value))
      }
    }

    const suffix = search.size > 0 ? `?${search}` : ''
    return this.request<T>(`${path}${suffix}`, options)
  }

  protected async request<T>(
    path: string,
    options?: JsonRequestOptions,
  ): Promise<T> {
    const { body, headers, ...requestOptions } = options ?? {}
    const hasBody = body !== undefined

    const response = await fetch(this.url(path), {
      ...requestOptions,
      body: hasBody ? JSON.stringify(toSnakeCase(body)) : undefined,
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    })

    const bodyResponse: unknown = await response.json().catch(() => undefined)
    const transformedBody = toCamelCase(bodyResponse)

    if (!response.ok) {
      const message =
        typeof transformedBody === 'object' &&
        transformedBody !== null &&
        'error' in transformedBody &&
        typeof transformedBody.error === 'string'
          ? transformedBody.error
          : `API request failed (${response.status})`

      throw this.createError(message, response.status, transformedBody)
    }

    return transformedBody as T
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path}`
  }

  protected createError(message: string, status: number, body: unknown) {
    return new JsonApiError(message, status, body)
  }
}

export class JsonApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'JsonApiError'
  }
}
