import { n as useSnackbar } from "./SnackbarProvider-Cdl3dNq5.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, LinearProgress, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { feature } from "topojson-client";
//#region src/api/json-api-client.ts
var toSnakeCaseKey = (key) => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toLowerCase();
var toCamelCaseKey = (key) => key.replace(/_+([a-zA-Z0-9])/g, (_, character) => character.toUpperCase());
var isPlainObject = (value) => {
	if (typeof value !== "object" || value === null) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};
var transformKeys = (value, transformKey) => {
	if (Array.isArray(value)) return value.map((item) => transformKeys(item, transformKey));
	if (!isPlainObject(value)) return value;
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [transformKey(key), transformKeys(item, transformKey)]));
};
var toSnakeCase = (value) => transformKeys(value, toSnakeCaseKey);
var toCamelCase = (value) => transformKeys(value, toCamelCaseKey);
/**
* Base client for JSON APIs that use snake_case over the wire and camelCase in
* TypeScript. Extend this class for each backend API client.
*/
var JsonApiClient = class {
	baseUrl;
	constructor(baseUrl) {
		this.baseUrl = baseUrl;
	}
	get(path, query, options) {
		const search = new URLSearchParams();
		for (const [key, value] of Object.entries(toSnakeCase(query))) if (value !== void 0) search.set(key, String(value));
		const suffix = search.size > 0 ? `?${search}` : "";
		return this.request(`${path}${suffix}`, options);
	}
	async request(path, options) {
		const { body, headers, ...requestOptions } = options ?? {};
		const hasBody = body !== void 0;
		const response = await fetch(this.url(path), {
			...requestOptions,
			body: hasBody ? JSON.stringify(toSnakeCase(body)) : void 0,
			headers: {
				Accept: "application/json",
				...hasBody ? { "Content-Type": "application/json" } : {},
				...headers
			}
		});
		const transformedBody = toCamelCase(await response.json().catch(() => void 0));
		if (!response.ok) {
			const message = typeof transformedBody === "object" && transformedBody !== null && "error" in transformedBody && typeof transformedBody.error === "string" ? transformedBody.error : `API request failed (${response.status})`;
			throw this.createError(message, response.status, transformedBody);
		}
		return transformedBody;
	}
	url(path) {
		return `${this.baseUrl.replace(/\/$/, "")}/${path}`;
	}
	createError(message, status, body) {
		return new JsonApiError(message, status, body);
	}
};
var JsonApiError = class extends Error {
	status;
	body;
	constructor(message, status, body) {
		super(message);
		this.status = status;
		this.body = body;
		this.name = "JsonApiError";
	}
};
//#endregion
//#region src/api/django-client.ts
var DjangoApiError = class extends JsonApiError {};
/**
* Client for the Django routes mounted at `/api/`.
*
* Set `VITE_DJANGO_API_URL` to a full URL when Django is hosted separately,
* for example `http://localhost:8000/api`.
*/
var DjangoApiClient = class extends JsonApiClient {
	constructor(baseUrl = "https://placczak.rvp.xayo.info/api") {
		super(baseUrl);
	}
	getWeatherData(sticky, options) {
		return this.get("weatherdata", { sticky }, options);
	}
	getBuienradar(coordinates, options) {
		return this.get("buienradar", coordinates, options);
	}
	getStickyPrediction(coordinates, options) {
		return this.get("stickyprediction", coordinates, options);
	}
	getStickyForecast(coordinates, options) {
		return this.get("forecaststicky", coordinates, options);
	}
	captureWeatherData(coordinates, options) {
		return this.request("capturedweatherdata", {
			...options,
			method: "POST",
			body: coordinates
		});
	}
	createError(message, status, body) {
		return new DjangoApiError(message, status, body);
	}
};
var djangoApi = new DjangoApiClient();
//#endregion
//#region src/api/django-queries.ts
var djangoQueryKeys = {
	weatherData: (sticky) => [
		"django",
		"weatherdata",
		sticky
	],
	buienradar: (coordinates) => [
		"django",
		"buienradar",
		coordinates
	],
	stickyPrediction: (coordinates) => [
		"django",
		"stickyprediction",
		coordinates
	],
	stickyForecast: (coordinates) => [
		"django",
		"forecaststicky",
		coordinates
	]
};
var stickyPredictionQueryOptions = (coordinates) => queryOptions({
	queryKey: djangoQueryKeys.stickyPrediction(coordinates),
	queryFn: () => djangoApi.getStickyPrediction(coordinates)
});
var stickyForecastQueryOptions = (coordinates) => queryOptions({
	queryKey: djangoQueryKeys.stickyForecast(coordinates),
	queryFn: () => djangoApi.getStickyForecast(coordinates)
});
//#endregion
//#region src/routes/utils/formatProbability.ts
var formatProbability = (probability) => `${(probability * 100).toFixed(2)}%`;
//#endregion
//#region src/routes/components/CurrentProbabilityCard/CurrentProbabilityCard.tsx
var CurrentProbabilityCard = ({ probability, isLoading }) => /* @__PURE__ */ jsx(Card, {
	sx: { flex: 1 },
	children: /* @__PURE__ */ jsxs(CardContent, { children: [
		/* @__PURE__ */ jsx(Typography, {
			component: "h2",
			variant: "h6",
			gutterBottom: true,
			children: "Current probability"
		}),
		isLoading ? /* @__PURE__ */ jsx(CircularProgress, { size: 28 }) : /* @__PURE__ */ jsx(Typography, {
			component: "p",
			variant: "h2",
			children: probability === void 0 ? "—" : formatProbability(probability)
		}),
		/* @__PURE__ */ jsx(Typography, {
			color: "text.secondary",
			variant: "body2",
			sx: { mt: 1 },
			children: "Estimated probability at your current location."
		})
	] })
});
//#endregion
//#region src/routes/components/ForecastCard/ForecastCard.tsx
var ForecastCard = ({ forecast }) => /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { children: [
	/* @__PURE__ */ jsx(Typography, {
		component: "h2",
		variant: "h5",
		children: "Forecast"
	}),
	/* @__PURE__ */ jsx(Typography, {
		color: "text.secondary",
		sx: { mb: 2 },
		children: forecast ? `Nearest station: ${forecast.nearestStation}` : "Loading nearest weather station…"
	}),
	/* @__PURE__ */ jsx(Divider, {}),
	/* @__PURE__ */ jsx(List, {
		disablePadding: true,
		children: forecast?.forecast.map((item) => /* @__PURE__ */ jsxs(ListItem, {
			divider: true,
			sx: { px: 0 },
			children: [/* @__PURE__ */ jsx(ListItemText, { primary: dayjs(item.datetime).format("DD MMM YYYY") }), /* @__PURE__ */ jsx(Chip, {
				label: formatProbability(item.probability),
				size: "small"
			})]
		}, item.datetime))
	})
] }) });
//#endregion
//#region src/routes/components/Heatmap/Heatmap.tsx
var NETHERLANDS_HEATMAP_BOUNDS = {
	latMin: 50.750383,
	latMax: 53.5,
	lonMin: 3.358402,
	lonMax: 7.22751
};
var NETHERLANDS_MAP_BOUNDS = [[50.2, 2.5], [54, 8]];
var netherlandsGeometry;
var loadNetherlandsGeometry = async () => {
	if (netherlandsGeometry) return netherlandsGeometry;
	const { default: countries50m } = await import("./countries-50m-DO216dcP.js");
	netherlandsGeometry = feature(countries50m, countries50m.objects.countries.geometries.find(({ id }) => id === "528"));
	return netherlandsGeometry;
};
var idwColor = (probability) => {
	return `hsla(${Math.round((1 - Math.min(Math.max(probability, 0), 1)) * 240)}, 85%, 48%, 0.58)`;
};
var createHeatmapGrid = () => {
	const rows = 6;
	const columns = 9;
	return Array.from({ length: rows * columns }, (_, index) => {
		const row = Math.floor(index / columns);
		const column = index % columns;
		return {
			lat: NETHERLANDS_HEATMAP_BOUNDS.latMin + (NETHERLANDS_HEATMAP_BOUNDS.latMax - NETHERLANDS_HEATMAP_BOUNDS.latMin) * row / (rows - 1),
			lon: NETHERLANDS_HEATMAP_BOUNDS.lonMin + (NETHERLANDS_HEATMAP_BOUNDS.lonMax - NETHERLANDS_HEATMAP_BOUNDS.lonMin) * column / (columns - 1)
		};
	});
};
var createIdwLayer = (leaflet, geometry, points) => {
	return new (leaflet.Layer.extend({
		onAdd(map) {
			this.map = map;
			this.canvas = leaflet.DomUtil.create("canvas", "leaflet-layer leaflet-zoom-animated");
			this.canvas.style.pointerEvents = "none";
			map.getPanes().overlayPane.appendChild(this.canvas);
			this.redraw = this.redraw.bind(this);
			map.on("moveend zoomend resize", this.redraw);
			this.redraw();
		},
		onRemove(map) {
			map.off("moveend zoomend resize", this.redraw);
			this.canvas.remove();
		},
		redraw() {
			const map = this.map;
			const canvas = this.canvas;
			const size = map.getSize();
			const topLeft = map.containerPointToLayerPoint([0, 0]);
			canvas.width = size.x;
			canvas.height = size.y;
			leaflet.DomUtil.setPosition(canvas, topLeft);
			const context = canvas.getContext("2d");
			if (!context) return;
			const polygons = geometry.geometry.type === "Polygon" ? [geometry.geometry.coordinates] : geometry.geometry.coordinates;
			context.save();
			context.beginPath();
			for (const polygon of polygons) for (const ring of polygon) {
				ring.forEach(([lon, lat], index) => {
					const point = map.latLngToContainerPoint([lat, lon]);
					if (index === 0) context.moveTo(point.x, point.y);
					else context.lineTo(point.x, point.y);
				});
				context.closePath();
			}
			context.clip("evenodd");
			const projectedPoints = points.map((point) => ({
				point: map.latLngToContainerPoint([point.lat, point.lon]),
				probability: point.probability
			}));
			const cellSize = 16;
			for (let y = 0; y < size.y; y += cellSize) for (let x = 0; x < size.x; x += cellSize) {
				let numerator = 0;
				let denominator = 0;
				for (const sample of projectedPoints) {
					const distanceSquared = (sample.point.x - x) ** 2 + (sample.point.y - y) ** 2;
					if (distanceSquared < 1) {
						numerator = sample.probability;
						denominator = 1;
						break;
					}
					const weight = 1 / Math.pow(Math.sqrt(distanceSquared), 3);
					numerator += sample.probability * weight;
					denominator += weight;
				}
				context.fillStyle = idwColor(numerator / denominator);
				context.fillRect(x, y, cellSize, cellSize);
			}
			context.restore();
		}
	}))();
};
var Heatmap = ({ regenerateToken }) => {
	const queryClient = useQueryClient();
	const { showSnackbar } = useSnackbar();
	const [heatmap, setHeatmap] = useState([]);
	const [progress, setProgress] = useState(0);
	const [isGenerating, setIsGenerating] = useState(false);
	const mapContainerRef = useRef(null);
	const mapRef = useRef(null);
	const grid = useMemo(createHeatmapGrid, []);
	const generate = useCallback(async () => {
		setIsGenerating(true);
		setProgress(0);
		try {
			await loadNetherlandsGeometry();
			let completed = 0;
			const generatedHeatmap = (await Promise.all(grid.map(async (point) => {
				try {
					const prediction = await queryClient.fetchQuery(stickyPredictionQueryOptions(point));
					return {
						...point,
						probability: prediction.probability
					};
				} catch {
					return null;
				} finally {
					completed += 1;
					setProgress(completed / grid.length * 100);
				}
			}))).filter((point) => point !== null);
			setHeatmap(generatedHeatmap);
			if (generatedHeatmap.length > 0) showSnackbar("Heatmap generated successfully.");
			else showSnackbar("Unable to generate heatmap data.", "error");
		} catch {
			showSnackbar("Unable to generate the heatmap.", "error");
		} finally {
			setIsGenerating(false);
		}
	}, [
		grid,
		queryClient,
		showSnackbar
	]);
	useEffect(() => {
		if (regenerateToken > 0) generate();
	}, [generate, regenerateToken]);
	useEffect(() => {
		if (!mapContainerRef.current || heatmap.length === 0) return;
		let isDisposed = false;
		import("leaflet").then((leaflet) => {
			if (isDisposed || !mapContainerRef.current) return;
			const geometry = netherlandsGeometry;
			if (!geometry) return;
			if (!mapRef.current) {
				const netherlandsBounds = leaflet.latLngBounds(NETHERLANDS_MAP_BOUNDS);
				const instance = leaflet.map(mapContainerRef.current, {
					maxBounds: netherlandsBounds,
					maxBoundsViscosity: 1,
					scrollWheelZoom: true
				}).fitBounds(netherlandsBounds);
				instance.setMinZoom(instance.getZoom());
				leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					attribution: "© OpenStreetMap contributors",
					maxZoom: 18
				}).addTo(instance);
				leaflet.geoJSON(geometry, {
					interactive: false,
					style: {
						color: "#263238",
						fill: false,
						weight: 1.5
					}
				}).addTo(instance);
				mapRef.current = {
					instance,
					heatmapLayer: null
				};
				requestAnimationFrame(() => instance.invalidateSize());
			}
			mapRef.current.heatmapLayer?.remove();
			const heatmapLayer = createIdwLayer(leaflet, geometry, heatmap);
			heatmapLayer.addTo(mapRef.current.instance);
			mapRef.current.heatmapLayer = heatmapLayer;
		});
		return () => {
			isDisposed = true;
		};
	}, [heatmap]);
	useEffect(() => () => {
		mapRef.current?.instance.remove();
		mapRef.current = null;
	}, []);
	return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(CardContent, { children: [
		/* @__PURE__ */ jsxs(Stack, {
			alignItems: {
				xs: "stretch",
				sm: "center"
			},
			direction: {
				xs: "column",
				sm: "row"
			},
			justifyContent: "space-between",
			spacing: 2,
			children: [/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsx(Typography, {
				component: "h2",
				variant: "h5",
				children: "Netherlands heatmap"
			}), /* @__PURE__ */ jsx(Typography, {
				color: "text.secondary",
				children: "Regional prediction samples from the weather API."
			})] }), /* @__PURE__ */ jsx(Button, {
				disabled: isGenerating,
				loading: isGenerating,
				onClick: generate,
				variant: "contained",
				children: "Generate heatmap"
			})]
		}),
		isGenerating && /* @__PURE__ */ jsxs(Box, {
			sx: { mt: 3 },
			children: [/* @__PURE__ */ jsx(LinearProgress, {
				value: progress,
				variant: "determinate",
				sx: {
					backgroundColor: "rgb(31 41 55)",
					borderRadius: 1,
					height: 8,
					"& .MuiLinearProgress-bar": {
						backgroundImage: "linear-gradient(90deg, rgb(255 0 0), rgb(0 255 0), rgb(0 0 255))",
						borderRadius: "inherit"
					}
				}
			}), /* @__PURE__ */ jsxs(Typography, {
				color: "text.secondary",
				sx: { mt: 1 },
				variant: "body2",
				children: [progress.toFixed(0), "% completed"]
			})]
		}),
		heatmap.length > 0 && /* @__PURE__ */ jsx(Box, {
			"aria-label": "Sticky-ball probability heatmap",
			ref: mapContainerRef,
			sx: {
				borderRadius: 1,
				height: {
					xs: 360,
					md: 560
				},
				mt: 3,
				overflow: "hidden"
			}
		})
	] }) });
};
//#endregion
//#region src/routes/components/LocationStatus/LocationStatus.tsx
var LocationStatus = ({ isLoading, locationError, hasDataError, hasCaptureError }) => /* @__PURE__ */ jsxs(Fragment, { children: [
	isLoading && /* @__PURE__ */ jsxs(Stack, {
		alignItems: "center",
		direction: "row",
		spacing: 1,
		children: [/* @__PURE__ */ jsx(CircularProgress, { size: 20 }), /* @__PURE__ */ jsx(Typography, {
			color: "text.secondary",
			children: "Finding your location…"
		})]
	}),
	locationError && /* @__PURE__ */ jsx(Alert, {
		severity: "warning",
		children: locationError
	}),
	hasDataError && /* @__PURE__ */ jsx(Alert, {
		severity: "error",
		children: "Unable to load weather data. Please try again."
	}),
	hasCaptureError && /* @__PURE__ */ jsx(Alert, {
		severity: "error",
		children: "Unable to save the measurement. Please try again."
	})
] });
//#endregion
//#region src/routes/components/MeasurementCard/MeasurementCard.tsx
var MeasurementCard = ({ coordinates, sticky, isSubmitting, onStickyChange, onSubmit }) => /* @__PURE__ */ jsx(Card, {
	sx: { flex: 1 },
	children: /* @__PURE__ */ jsxs(CardContent, { children: [
		/* @__PURE__ */ jsx(Typography, {
			component: "h2",
			variant: "h6",
			gutterBottom: true,
			children: "Record your conditions"
		}),
		/* @__PURE__ */ jsx(FormControlLabel, {
			control: /* @__PURE__ */ jsx(Checkbox, {
				checked: sticky,
				onChange: (event) => onStickyChange(event.target.checked)
			}),
			label: "I have a sticky sack"
		}),
		/* @__PURE__ */ jsx(Box, {
			sx: { mt: 2 },
			children: /* @__PURE__ */ jsx(Button, {
				disabled: !coordinates || isSubmitting,
				loading: isSubmitting,
				onClick: onSubmit,
				variant: "contained",
				children: "Submit measurement"
			})
		})
	] })
});
//#endregion
//#region src/routes/hooks/useCurrentLocation.ts
var useCurrentLocation = () => {
	const [coordinates, setCoordinates] = useState(null);
	const [error, setError] = useState(null);
	useEffect(() => {
		if (!navigator.geolocation) {
			setError("Location services are not supported by this browser.");
			return;
		}
		navigator.geolocation.getCurrentPosition((position) => {
			setCoordinates({
				lat: position.coords.latitude,
				lon: position.coords.longitude
			});
		}, () => setError("Allow location access to load your local forecast."));
	}, []);
	return {
		coordinates,
		error,
		isLoading: coordinates === null && error === null
	};
};
//#endregion
//#region src/routes/page.tsx?tsr-split=component
function Home() {
	const queryClient = useQueryClient();
	const { coordinates, error: locationError, isLoading } = useCurrentLocation();
	const [sticky, setSticky] = useState(false);
	const [heatmapRegenerateToken, setHeatmapRegenerateToken] = useState(0);
	const predictionQuery = useQuery({
		...stickyPredictionQueryOptions(coordinates ?? {
			lat: 0,
			lon: 0
		}),
		enabled: coordinates !== null
	});
	const forecastQuery = useQuery({
		...stickyForecastQueryOptions(coordinates ?? {
			lat: 0,
			lon: 0
		}),
		enabled: coordinates !== null
	});
	const captureMutation = useMutation({
		mutationFn: (input) => djangoApi.captureWeatherData(input),
		onSuccess: async (_, input) => {
			if (!coordinates) return;
			await Promise.all([queryClient.invalidateQueries({ queryKey: djangoQueryKeys.stickyPrediction(coordinates) }), queryClient.invalidateQueries({ queryKey: djangoQueryKeys.stickyForecast(coordinates) })]);
			if (input.sticky) setHeatmapRegenerateToken((token) => token + 1);
		}
	});
	const dataError = predictionQuery.error ?? forecastQuery.error;
	return /* @__PURE__ */ jsxs(Stack, {
		spacing: 3,
		sx: { py: 4 },
		children: [
			/* @__PURE__ */ jsx(LocationStatus, {
				hasCaptureError: captureMutation.isError,
				hasDataError: Boolean(dataError),
				isLoading,
				locationError
			}),
			/* @__PURE__ */ jsxs(Stack, {
				direction: {
					xs: "column",
					md: "row"
				},
				spacing: 3,
				children: [/* @__PURE__ */ jsx(MeasurementCard, {
					coordinates,
					isSubmitting: captureMutation.isPending,
					onStickyChange: setSticky,
					onSubmit: () => coordinates && captureMutation.mutate({
						...coordinates,
						sticky
					}),
					sticky
				}), /* @__PURE__ */ jsx(CurrentProbabilityCard, {
					isLoading: predictionQuery.isLoading,
					probability: predictionQuery.data?.probability
				})]
			}),
			/* @__PURE__ */ jsx(ForecastCard, { forecast: forecastQuery.data }),
			/* @__PURE__ */ jsx(Heatmap, { regenerateToken: heatmapRegenerateToken })
		]
	});
}
//#endregion
export { Home as component };
