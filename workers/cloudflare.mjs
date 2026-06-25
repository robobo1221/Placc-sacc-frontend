import app from '../dist/server/server.js'

const apiPathPattern = /^\/api(?:\/|$)/
const nameShimScript =
  '<script>globalThis.__name=globalThis.__name||((target)=>target)</script>'

const proxyApiRequest = (request, apiUrl) => {
  const requestUrl = new URL(request.url)
  const targetUrl = new URL(apiUrl)
  const apiBasePath = targetUrl.pathname.replace(/\/$/, '')
  const proxiedPath = requestUrl.pathname.replace(/^\/api/, '')

  targetUrl.pathname = `${apiBasePath}${proxiedPath}`
  targetUrl.search = requestUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')

  return fetch(
    new Request(targetUrl, {
      body: request.body,
      headers,
      method: request.method,
      redirect: request.redirect,
    }),
  )
}

const withBrowserNameShim = async (response) => {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('text/html')) {
    return response
  }

  const html = await response.text()

  const headers = new Headers(response.headers)
  headers.delete('content-length')

  const body = html.includes('globalThis.__name')
    ? html
    : html.replace('</head>', `${nameShimScript}</head>`)

  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' })
    }

    if (apiPathPattern.test(url.pathname) && env.DJANGO_API_URL) {
      return proxyApiRequest(request, env.DJANGO_API_URL)
    }

    const assetResponse = await env.ASSETS.fetch(request)

    if (assetResponse.status !== 404) {
      return assetResponse
    }

    return withBrowserNameShim(await app.fetch(request, env))
  },
}
