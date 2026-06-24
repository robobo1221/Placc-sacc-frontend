import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Alert, Snackbar } from "@mui/material";
//#region src/components/SnackbarProvider/SnackbarProvider.tsx
var SnackbarContext = createContext(null);
var SnackbarProvider = ({ children }) => {
	const [snackbar, setSnackbar] = useState(null);
	const showSnackbar = useCallback((message, severity = "success") => {
		setSnackbar({
			message,
			severity
		});
	}, []);
	const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);
	return /* @__PURE__ */ jsxs(SnackbarContext.Provider, {
		value,
		children: [children, /* @__PURE__ */ jsx(Snackbar, {
			anchorOrigin: {
				horizontal: "right",
				vertical: "bottom"
			},
			autoHideDuration: 5e3,
			onClose: () => setSnackbar(null),
			open: snackbar !== null,
			children: /* @__PURE__ */ jsx(Alert, {
				onClose: () => setSnackbar(null),
				severity: snackbar?.severity,
				variant: "filled",
				children: snackbar?.message
			})
		})]
	});
};
var useSnackbar = () => {
	const context = useContext(SnackbarContext);
	if (!context) throw new Error("useSnackbar must be used within a SnackbarProvider.");
	return context;
};
//#endregion
export { useSnackbar as n, SnackbarProvider as t };
