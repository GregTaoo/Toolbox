"use client";

import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#635bff" }, secondary: { main: "#00a884" }, background: { default: "#f7f8fc", paper: "#ffffff" } },
  typography: { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif", h1: { fontWeight: 800, letterSpacing: "-0.04em" }, h2: { fontWeight: 800, letterSpacing: "-0.03em" }, h4: { fontWeight: 750 }, button: { textTransform: "none", fontWeight: 700 } },
  shape: { borderRadius: 16 },
  components: { MuiButton: { defaultProps: { disableElevation: true } }, MuiCard: { styleOverrides: { root: { border: "1px solid #e8eaf2", boxShadow: "0 12px 40px rgba(32, 38, 70, .06)" } } } },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
