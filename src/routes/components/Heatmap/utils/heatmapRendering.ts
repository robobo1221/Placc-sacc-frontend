import { feature } from 'topojson-client'

import type { Coordinates } from '#/api/django-client.ts'
import type { Theme } from '@mui/material/styles'

export type HeatmapPoint = Coordinates & { probability: number }
export type LeafletModule = typeof import('leaflet')
export type LeafletMap = import('leaflet').Map
export type LeafletLayer = import('leaflet').Layer

export type NetherlandsGeometry = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>

export type HeatmapMapRef = {
  instance: LeafletMap
  heatmapLayer: LeafletLayer | null
  leaflet: LeafletModule
  geometry: NetherlandsGeometry
}

export type HeatmapLayerStyle = Theme['heatmap'] & {
  colorLookupTable: Uint8ClampedArray
}

export type HeatmapSelection = Coordinates & {
  probability: number
}

export const NETHERLANDS_MAP_BOUNDS: [[number, number], [number, number]] = [
  [50.2, 2.5],
  [54, 8],
]

const NETHERLANDS_HEATMAP_BOUNDS = {
  latMin: 50.750383,
  latMax: 53.5,
  lonMin: 3.358402,
  lonMax: 7.22751,
}

const IDW_POWER = 3
const MAX_INTERPOLATION_PIXELS = 90_000
const MAX_INTERPOLATION_SCALE = 0.5
const COLOR_LUT_SIZE = 256
const CONTOUR_LEVELS = Array.from({ length: 9 }, (_, index) => (index + 1) / 10)

type ContourSegment = {
  level: number
  x1: number
  y1: number
  x2: number
  y2: number
}

let leafletModulePromise: Promise<LeafletModule> | undefined
let netherlandsGeometryPromise: Promise<NetherlandsGeometry> | undefined
let netherlandsGeometry: NetherlandsGeometry | undefined

export const loadLeafletModule = () => {
  leafletModulePromise ??= import('leaflet')
  return leafletModulePromise
}

export const loadNetherlandsGeometry = async () => {
  if (netherlandsGeometry) return netherlandsGeometry

  netherlandsGeometryPromise ??= import('world-atlas/countries-10m.json').then(
    ({ default: countries50m }) => {
      netherlandsGeometry = feature(
        countries50m as any,
        countries50m.objects.countries.geometries.find(
          ({ id }) => id === '528',
        )! as any,
      ) as NetherlandsGeometry

      return netherlandsGeometry
    },
  )

  return netherlandsGeometryPromise
}

export const preloadMapDependencies = () => {
  void loadLeafletModule()
  void loadNetherlandsGeometry()
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

const createColorLookupTable = (overlayAlpha: number) => {
  const table = new Uint8ClampedArray(COLOR_LUT_SIZE * 4)
  const alpha = Math.round(255 * overlayAlpha)

  for (let index = 0; index < COLOR_LUT_SIZE; index += 1) {
    const probability = index / (COLOR_LUT_SIZE - 1)
    const hue = Math.round((1 - probability) * 240)
    const { r, g, b } = hslToRgb(hue, 85, 48)
    const offset = index * 4

    table[offset] = r
    table[offset + 1] = g
    table[offset + 2] = b
    table[offset + 3] = alpha
  }

  return table
}

export const createHeatmapLayerStyle = (
  heatmapTheme: Theme['heatmap'],
): HeatmapLayerStyle => ({
  ...heatmapTheme,
  colorLookupTable: createColorLookupTable(heatmapTheme.overlayAlpha),
})

const writeColor = (
  target: Uint8ClampedArray,
  targetOffset: number,
  probability: number,
  colorLookupTable: Uint8ClampedArray,
) => {
  const colorIndex =
    Math.round(clamp(probability, 0, 1) * (COLOR_LUT_SIZE - 1)) * 4

  target[targetOffset] = colorLookupTable[colorIndex]
  target[targetOffset + 1] = colorLookupTable[colorIndex + 1]
  target[targetOffset + 2] = colorLookupTable[colorIndex + 2]
  target[targetOffset + 3] = colorLookupTable[colorIndex + 3]
}

const getInterpolationScale = (width: number, height: number) => {
  const totalPixels = width * height

  if (totalPixels <= MAX_INTERPOLATION_PIXELS) {
    return 1
  }

  return Math.min(
    MAX_INTERPOLATION_SCALE,
    Math.sqrt(MAX_INTERPOLATION_PIXELS / totalPixels),
  )
}

const interpolateProbability = (
  x: number,
  y: number,
  sampleXs: Float32Array,
  sampleYs: Float32Array,
  sampleProbabilities: Float32Array,
) => {
  let numerator = 0
  let denominator = 0

  for (let sampleIndex = 0; sampleIndex < sampleXs.length; sampleIndex += 1) {
    const dx = sampleXs[sampleIndex] - x
    const dy = sampleYs[sampleIndex] - y
    const distanceSquared = dx * dx + dy * dy

    if (distanceSquared < 0.0001) {
      return sampleProbabilities[sampleIndex]
    }

    const weight = 1 / Math.pow(distanceSquared, IDW_POWER / 2)

    numerator += sampleProbabilities[sampleIndex] * weight
    denominator += weight
  }

  return denominator === 0 ? 0 : numerator / denominator
}

export const getHeatmapSelection = (
  map: LeafletMap,
  lat: number,
  lon: number,
  points: HeatmapPoint[],
): HeatmapSelection | null => {
  if (points.length === 0) return null

  const bounds = map.getBounds()

  if (!bounds.contains([lat, lon])) return null

  const sampleCount = points.length
  const sampleXs = new Float32Array(sampleCount)
  const sampleYs = new Float32Array(sampleCount)
  const sampleProbabilities = new Float32Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const point = points[index]
    const projectedPoint = map.latLngToContainerPoint([point.lat, point.lon])

    sampleXs[index] = projectedPoint.x
    sampleYs[index] = projectedPoint.y
    sampleProbabilities[index] = point.probability
  }

  const clickedPoint = map.latLngToContainerPoint([lat, lon])

  return {
    lat,
    lon,
    probability: interpolateProbability(
      clickedPoint.x,
      clickedPoint.y,
      sampleXs,
      sampleYs,
      sampleProbabilities,
    ),
  }
}

export const createHeatmapGrid = (): Coordinates[] => {
  const rows = 4
  const columns = 6

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns

    return {
      lat:
        NETHERLANDS_HEATMAP_BOUNDS.latMin +
        ((NETHERLANDS_HEATMAP_BOUNDS.latMax -
          NETHERLANDS_HEATMAP_BOUNDS.latMin) *
          row) /
          (rows - 1),
      lon:
        NETHERLANDS_HEATMAP_BOUNDS.lonMin +
        ((NETHERLANDS_HEATMAP_BOUNDS.lonMax -
          NETHERLANDS_HEATMAP_BOUNDS.lonMin) *
          column) /
          (columns - 1),
    }
  })
}

const getContourEdgePoint = (
  edge: number,
  x: number,
  y: number,
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  level: number,
) => {
  const interpolate = (a: number, b: number) => {
    if (Math.abs(a - b) < 0.000001) return 0.5
    return clamp((level - a) / (b - a), 0, 1)
  }

  switch (edge) {
    case 0: {
      const t = interpolate(topLeft, topRight)
      return { x: x + t, y }
    }

    case 1: {
      const t = interpolate(topRight, bottomRight)
      return { x: x + 1, y: y + t }
    }

    case 2: {
      const t = interpolate(bottomLeft, bottomRight)
      return { x: x + t, y: y + 1 }
    }

    default: {
      const t = interpolate(topLeft, bottomLeft)
      return { x, y: y + t }
    }
  }
}

const createContourSegments = (
  probabilities: Float32Array,
  width: number,
  height: number,
) => {
  const segments: ContourSegment[] = []

  for (const level of CONTOUR_LEVELS) {
    for (let y = 0; y < height - 1; y += 1) {
      for (let x = 0; x < width - 1; x += 1) {
        const topLeft = probabilities[y * width + x]
        const topRight = probabilities[y * width + x + 1]
        const bottomLeft = probabilities[(y + 1) * width + x]
        const bottomRight = probabilities[(y + 1) * width + x + 1]

        const intersections: Array<{ x: number; y: number }> = []

        if (topLeft < level !== topRight < level) {
          intersections.push(
            getContourEdgePoint(
              0,
              x,
              y,
              topLeft,
              topRight,
              bottomRight,
              bottomLeft,
              level,
            ),
          )
        }

        if (topRight < level !== bottomRight < level) {
          intersections.push(
            getContourEdgePoint(
              1,
              x,
              y,
              topLeft,
              topRight,
              bottomRight,
              bottomLeft,
              level,
            ),
          )
        }

        if (bottomLeft < level !== bottomRight < level) {
          intersections.push(
            getContourEdgePoint(
              2,
              x,
              y,
              topLeft,
              topRight,
              bottomRight,
              bottomLeft,
              level,
            ),
          )
        }

        if (topLeft < level !== bottomLeft < level) {
          intersections.push(
            getContourEdgePoint(
              3,
              x,
              y,
              topLeft,
              topRight,
              bottomRight,
              bottomLeft,
              level,
            ),
          )
        }

        if (intersections.length === 2) {
          segments.push({
            level,
            x1: intersections[0].x,
            y1: intersections[0].y,
            x2: intersections[1].x,
            y2: intersections[1].y,
          })
        }

        if (intersections.length === 4) {
          segments.push({
            level,
            x1: intersections[0].x,
            y1: intersections[0].y,
            x2: intersections[1].x,
            y2: intersections[1].y,
          })

          segments.push({
            level,
            x1: intersections[2].x,
            y1: intersections[2].y,
            x2: intersections[3].x,
            y2: intersections[3].y,
          })
        }
      }
    }
  }

  return segments
}

const drawContourLines = (
  context: CanvasRenderingContext2D,
  segments: ContourSegment[],
  scaleX: number,
  scaleY: number,
  style: HeatmapLayerStyle,
) => {
  context.save()

  context.lineWidth = 1.2
  context.strokeStyle = style.contourLineColor
  context.setLineDash([6, 4])

  context.beginPath()

  for (const segment of segments) {
    context.moveTo(segment.x1 * scaleX, segment.y1 * scaleY)
    context.lineTo(segment.x2 * scaleX, segment.y2 * scaleY)
  }

  context.stroke()
  context.restore()
}

const drawContourLabels = (
  context: CanvasRenderingContext2D,
  segments: ContourSegment[],
  scaleX: number,
  scaleY: number,
  style: HeatmapLayerStyle,
  shouldDrawLabel: (x: number, y: number) => boolean,
) => {
  context.save()

  context.font = style.contourLabelFont
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const labelsPerLevel = new Map<number, number>()

  for (const segment of segments) {
    const labelCount = labelsPerLevel.get(segment.level) ?? 0

    if (labelCount >= 8) continue

    const midpointX = ((segment.x1 + segment.x2) / 2) * scaleX
    const midpointY = ((segment.y1 + segment.y2) / 2) * scaleY

    if (!shouldDrawLabel(midpointX, midpointY)) continue
    if ((segment.x1 + segment.y1 + labelCount * 37) % 95 > 2) continue

    const label = `${Math.round(segment.level * 100)}%`
    const metrics = context.measureText(label)
    const labelWidth = metrics.width + 8
    const labelHeight = 16

    context.fillStyle = style.contourLabelBackground
    context.fillRect(
      midpointX - labelWidth / 2,
      midpointY - labelHeight / 2,
      labelWidth,
      labelHeight,
    )

    context.fillStyle = style.contourLabelColor
    context.fillText(label, midpointX, midpointY)

    labelsPerLevel.set(segment.level, labelCount + 1)
  }

  context.restore()
}

const createGeometryPath = (map: LeafletMap, geometry: NetherlandsGeometry) => {
  const path = new Path2D()
  const polygons =
    geometry.geometry.type === 'Polygon'
      ? [geometry.geometry.coordinates]
      : geometry.geometry.coordinates

  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const point = map.latLngToContainerPoint([lat, lon])

        if (index === 0) {
          path.moveTo(point.x, point.y)
        } else {
          path.lineTo(point.x, point.y)
        }
      })

      path.closePath()
    }
  }

  return path
}

export const createIdwLayer = (
  leaflet: LeafletModule,
  geometry: NetherlandsGeometry,
  points: HeatmapPoint[],
  style: HeatmapLayerStyle,
): LeafletLayer => {
  const IdwLayer = leaflet.Layer.extend({
    initialize(this: any) {
      this.frame = null
      this.offscreenCanvas = document.createElement('canvas')
      this.offscreenContext = this.offscreenCanvas.getContext('2d', {
        willReadFrequently: false,
      })
    },

    onAdd(this: any, map: LeafletMap) {
      this.map = map
      this.canvas = leaflet.DomUtil.create(
        'canvas',
        'leaflet-layer leaflet-zoom-animated',
      )

      this.canvas.style.pointerEvents = 'none'

      map.getPanes().overlayPane.appendChild(this.canvas)

      this.scheduleRedraw = this.scheduleRedraw.bind(this)
      this.redraw = this.redraw.bind(this)

      map.on('moveend zoomend resize', this.scheduleRedraw)

      this.scheduleRedraw()
    },

    onRemove(this: any, map: LeafletMap) {
      map.off('moveend zoomend resize', this.scheduleRedraw)

      if (this.frame !== null) {
        cancelAnimationFrame(this.frame)
        this.frame = null
      }

      this.canvas.remove()
    },

    scheduleRedraw(this: any) {
      if (this.frame !== null) return

      this.frame = requestAnimationFrame(() => {
        this.frame = null
        this.redraw()
      })
    },

    redraw(this: any) {
      const map = this.map as LeafletMap
      const canvas = this.canvas as HTMLCanvasElement
      const context = canvas.getContext('2d')

      if (!context) return

      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])

      if (canvas.width !== size.x) {
        canvas.width = size.x
      }

      if (canvas.height !== size.y) {
        canvas.height = size.y
      }

      leaflet.DomUtil.setPosition(canvas, topLeft)

      context.clearRect(0, 0, size.x, size.y)

      if (points.length === 0) return

      const scale = getInterpolationScale(size.x, size.y)
      const interpolationWidth = Math.max(1, Math.ceil(size.x * scale))
      const interpolationHeight = Math.max(1, Math.ceil(size.y * scale))

      const offscreenCanvas = this.offscreenCanvas as HTMLCanvasElement
      const offscreenContext = this.offscreenContext as CanvasRenderingContext2D

      if (!offscreenContext) return

      if (offscreenCanvas.width !== interpolationWidth) {
        offscreenCanvas.width = interpolationWidth
      }

      if (offscreenCanvas.height !== interpolationHeight) {
        offscreenCanvas.height = interpolationHeight
      }

      const sampleCount = points.length
      const sampleXs = new Float32Array(sampleCount)
      const sampleYs = new Float32Array(sampleCount)
      const sampleProbabilities = new Float32Array(sampleCount)

      for (let index = 0; index < sampleCount; index += 1) {
        const point = points[index]
        const projectedPoint = map.latLngToContainerPoint([
          point.lat,
          point.lon,
        ])

        sampleXs[index] = projectedPoint.x * scale
        sampleYs[index] = projectedPoint.y * scale
        sampleProbabilities[index] = point.probability
      }

      const imageData = offscreenContext.createImageData(
        interpolationWidth,
        interpolationHeight,
      )

      const data = imageData.data
      const probabilities = new Float32Array(
        interpolationWidth * interpolationHeight,
      )

      for (let y = 0; y < interpolationHeight; y += 1) {
        for (let x = 0; x < interpolationWidth; x += 1) {
          const probability = interpolateProbability(
            x,
            y,
            sampleXs,
            sampleYs,
            sampleProbabilities,
          )
          const offset = (y * interpolationWidth + x) * 4

          probabilities[y * interpolationWidth + x] = probability
          writeColor(data, offset, probability, style.colorLookupTable)
        }
      }

      offscreenContext.putImageData(imageData, 0, 0)

      const geometryPath = createGeometryPath(map, geometry)
      const contourSegments = createContourSegments(
        probabilities,
        interpolationWidth,
        interpolationHeight,
      )
      const contourScaleX = size.x / interpolationWidth
      const contourScaleY = size.y / interpolationHeight

      context.save()
      context.clip(geometryPath, 'evenodd')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'

      context.drawImage(
        offscreenCanvas,
        0,
        0,
        interpolationWidth,
        interpolationHeight,
        0,
        0,
        size.x,
        size.y,
      )

      drawContourLines(
        context,
        contourSegments,
        contourScaleX,
        contourScaleY,
        style,
      )

      context.restore()

      drawContourLabels(
        context,
        contourSegments,
        contourScaleX,
        contourScaleY,
        style,
        (x, y) => context.isPointInPath(geometryPath, x, y, 'evenodd'),
      )
    },
  })

  return new IdwLayer()
}
