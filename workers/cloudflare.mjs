import app from '../dist/server/server.js'

const apiPathPattern = /^\/api(?:\/|$)/

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

    return app.fetch(request, env)
  },
}
