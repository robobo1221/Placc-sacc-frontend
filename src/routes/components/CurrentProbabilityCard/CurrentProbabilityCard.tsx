import { Card, CardContent, CircularProgress, Typography } from '@mui/material'

import { formatProbability } from '#/routes/utils/formatProbability'

type CurrentProbabilityCardProps = {
  probability?: number
  isLoading: boolean
}

export const CurrentProbabilityCard = ({
  probability,
  isLoading,
}: CurrentProbabilityCardProps) => (
  <Card sx={{ flex: 1 }}>
    <CardContent>
      <Typography component="h2" variant="h6" gutterBottom>
        Current probability
      </Typography>
      {isLoading ? (
        <CircularProgress size={28} />
      ) : (
        <Typography component="p" variant="h2">
          {probability === undefined ? '—' : formatProbability(probability)}
        </Typography>
      )}
      <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
        Estimated probability at your current location.
      </Typography>
    </CardContent>
  </Card>
)
