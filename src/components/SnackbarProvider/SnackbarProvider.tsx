import { Alert, Snackbar } from '@mui/material'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import type { AlertColor } from '@mui/material'
import type { PropsWithChildren } from 'react'

type SnackbarMessage = {
  message: string
  severity: AlertColor
}

type SnackbarContextValue = {
  showSnackbar: (message: string, severity?: AlertColor) => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

export const SnackbarProvider = ({ children }: PropsWithChildren) => {
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null)

  const showSnackbar = useCallback(
    (message: string, severity: AlertColor = 'success') => {
      setSnackbar({ message, severity })
    },
    [],
  )
  const value = useMemo(() => ({ showSnackbar }), [showSnackbar])

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        open={snackbar !== null}
      >
        <Alert
          onClose={() => setSnackbar(null)}
          severity={snackbar?.severity}
          variant="filled"
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  )
}

export const useSnackbar = () => {
  const context = useContext(SnackbarContext)

  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider.')
  }

  return context
}
