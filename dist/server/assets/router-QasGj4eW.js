import { HeadContent, Outlet, Scripts, createFileRoute, createRootRouteWithContext, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Container, Toolbar, Typography } from "@mui/material";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
//#region src/integrations/tanstack-query/root-provider.tsx
function getContext() {
	return { queryClient: new QueryClient() };
}
function TanstackQueryProvider({ children, queryClient }) {
	return /* @__PURE__ */ jsx(QueryClientProvider, {
		client: queryClient,
		children
	});
}
//#endregion
//#region src/theme.ts
var theme = createTheme({
	palette: {
		mode: "light",
		primary: { main: "#1976d2" },
		secondary: { main: "#9c27b0" },
		background: {
			default: "#fafafa",
			paper: "#fafafa"
		}
	},
	shape: { borderRadius: 8 },
	components: {
		MuiCssBaseline: { styleOverrides: { body: { backgroundColor: "#fafafa" } } },
		MuiPaper: { styleOverrides: { root: { backgroundColor: "#fafafa" } } },
		MuiCard: { styleOverrides: { root: { backgroundColor: "#fafafa" } } },
		MuiDrawer: { styleOverrides: { paper: { backgroundColor: "#fafafa" } } },
		MuiToolbar: { styleOverrides: { root: {
			backgroundColor: "#1976d2",
			color: "#fff",
			paddingLeft: "16px",
			paddingRight: "16px",
			boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)"
		} } }
	}
});
//#endregion
//#region src/routes/components/AppBar/AppBar.tsx
var AppBar = () => {
	return /* @__PURE__ */ jsx(Toolbar, {
		disableGutters: true,
		children: /* @__PURE__ */ jsx(Typography, {
			variant: "h6",
			noWrap: true,
			component: "div",
			sx: {
				mr: 2,
				display: {
					xs: "none",
					md: "flex"
				}
			},
			children: "Weather App"
		})
	});
};
//#endregion
//#region src/routes/__root.tsx
var Route$1 = createRootRouteWithContext()({ component: RootComponent });
function RootComponent() {
	const { queryClient } = Route$1.useRouteContext();
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [/* @__PURE__ */ jsxs(ThemeProvider, {
			theme,
			children: [/* @__PURE__ */ jsx(CssBaseline, { enableColorScheme: true }), /* @__PURE__ */ jsxs(TanstackQueryProvider, {
				queryClient,
				children: [/* @__PURE__ */ jsx(AppBar, {}), /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Outlet, {}) })]
			})]
		}), /* @__PURE__ */ jsx(Scripts, {})] })]
	});
}
//#endregion
//#region src/routes/page.tsx
var $$splitComponentImporter = () => import("./page-BVTXqMKJ.js");
//#endregion
//#region src/routeTree.gen.ts
var rootRouteChildren = { PageRoute: createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") }).update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$1
}) };
var routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	const context = getContext();
	const router = createRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient: context.queryClient
	});
	return router;
}
//#endregion
export { getRouter };
