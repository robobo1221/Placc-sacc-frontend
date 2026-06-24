// src/routes/__root.tsx
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

import TanstackQueryProvider from '../integrations/tanstack-query/root-provider'
import { theme } from '../theme'
import { SnackbarProvider } from '../components/SnackbarProvider/SnackbarProvider'

import type { RouterContext } from '../integrations/tanstack-query/root-provider'
import { Container } from '@mui/material'
import { AppBar } from '#/routes/components/AppBar/AppBar.tsx'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <TanstackQueryProvider queryClient={queryClient}>
            <SnackbarProvider>
              <AppBar />
              <Container>
                <Outlet />
              </Container>
            </SnackbarProvider>
          </TanstackQueryProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
