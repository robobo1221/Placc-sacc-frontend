import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDirectory = path.join(dirname, 'dist', 'client')
const { default: app } = await import('./dist/server/server.js')
const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const host = process.env.HOST ?? '127.0.0.1'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

const getStaticFile = async (pathname) => {
  const filePath = path.resolve(clientDirectory, `.${pathname}`)

  if (!filePath.startsWith(`${clientDirectory}${path.sep}`)) return null

  try {
    const fileStat = await stat(filePath)
    return fileStat.isFile() ? filePath : null
  } catch {
    return null
  }
}

const createHeaders = (headers) => {
  const requestHeaders = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  return requestHeaders
}

const server = createServer(async (request, response) => {
  const hostHeader = request.headers.host ?? `${host}:${port}`
  const url = new URL(request.url ?? '/', `http://${hostHeader}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end('{"status":"ok"}')
    return
  }

  const staticFile = await getStaticFile(decodeURIComponent(url.pathname))
  if (staticFile) {
    const extension = path.extname(staticFile)
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    createReadStream(staticFile).pipe(response)
    return
  }

  const method = request.method ?? 'GET'
  const appRequest = new Request(url, {
    body:
      method === 'GET' || method === 'HEAD'
        ? undefined
        : Readable.toWeb(request),
    duplex: 'half',
    headers: createHeaders(request.headers),
    method,
  })
  const appResponse = await app.fetch(appRequest)

  response.writeHead(
    appResponse.status,
    Object.fromEntries(appResponse.headers.entries()),
  )

  if (!appResponse.body || method === 'HEAD') {
    response.end()
    return
  }

  Readable.fromWeb(appResponse.body).pipe(response)
})

server.listen(port, host, () => {
  console.log(`Placc Sacc frontend listening on http://${host}:${port}`)
})
