import { createTheme } from '@mui/material/styles'

type HeatmapTheme = {
  boundaryColor: string
  contourLabelBackground: string
  contourLabelColor: string
  contourLabelFont: string
  contourLineColor: string
  overlayAlpha: number
  progressBarBackground: string
  progressBarGradient: string
}

declare module '@mui/material/styles' {
  interface Theme {
    heatmap: HeatmapTheme
  }

  interface ThemeOptions {
    heatmap?: HeatmapTheme
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    background: {
      default: '#fafafa',
      paper: '#fafafa',
    },
  },
  shape: {
    borderRadius: 8,
  },
  heatmap: {
    boundaryColor: '#263238',
    contourLabelBackground: 'rgba(255, 255, 255, 0.82)',
    contourLabelColor: 'rgb(17, 24, 39)',
    contourLabelFont:
      '600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    contourLineColor: 'rgba(17, 24, 39, 0.78)',
    overlayAlpha: 0.58,
    progressBarBackground: 'rgb(31 41 55)',
    progressBarGradient:
      'linear-gradient(90deg, rgb(255 0 0), rgb(0 255 0), rgb(0 0 255))',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#fafafa',
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#fafafa',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#fafafa',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#fafafa',
        },
      },
    },

    MuiContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#fafafa',
        },
      },
    },

    MuiToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1976d2',
          color: '#fff',
          paddingLeft: '16px',
          paddingRight: '16px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
        },
      },
    },
  },
})
