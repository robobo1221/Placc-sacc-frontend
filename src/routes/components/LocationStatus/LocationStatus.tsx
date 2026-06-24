import { Alert, CircularProgress, Stack, Typography } from '@mui/material'

type LocationStatusProps = {
  isLoading: boolean
  locationError: string | null
  hasDataError: boolean
  hasCaptureError: boolean
}

export const LocationStatus = ({
  isLoading,
  locationError,
  hasDataError,
  hasCaptureError,
}: LocationStatusProps) => (
  <>
    {isLoading && (
      <Stack alignItems="center" direction="row" spacing={1}>
        <CircularProgress size={20} />
        <Typography color="text.secondary">Finding your location…</Typography>
      </Stack>
    )}
    {locationError && <Alert severity="warning">{locationError}</Alert>}
    {hasDataError && (
      <Alert severity="error">
        Unable to load weather data. Please try again.
      </Alert>
    )}
    {hasCaptureError && (
      <Alert severity="error">
        Unable to save the measurement. Please try again.
      </Alert>
    )}
  </>
)
