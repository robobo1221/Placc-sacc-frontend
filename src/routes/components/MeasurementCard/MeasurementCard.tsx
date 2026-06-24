import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Typography,
} from '@mui/material'

import type { Coordinates } from '#/api/django-client'

type MeasurementCardProps = {
  coordinates: Coordinates | null
  sticky: boolean
  isSubmitting: boolean
  onStickyChange: (sticky: boolean) => void
  onSubmit: () => void
}

export const MeasurementCard = ({
  coordinates,
  sticky,
  isSubmitting,
  onStickyChange,
  onSubmit,
}: MeasurementCardProps) => (
  <Card sx={{ flex: 1 }}>
    <CardContent>
      <Typography component="h2" variant="h6" gutterBottom>
        Record your conditions
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={sticky}
            onChange={(event) => onStickyChange(event.target.checked)}
          />
        }
        label="I have a sticky sack"
      />
      <Box sx={{ mt: 2 }}>
        <Button
          disabled={!coordinates || isSubmitting}
          loading={isSubmitting}
          onClick={onSubmit}
          variant="contained"
        >
          Submit measurement
        </Button>
      </Box>
    </CardContent>
  </Card>
)
