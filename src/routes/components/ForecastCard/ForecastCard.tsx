import {
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'

import { formatProbability } from '#/routes/utils/formatProbability'

import type { StickyWeatherForecast } from '#/api/django-client'

type ForecastCardProps = {
  forecast?: StickyWeatherForecast
}

export const ForecastCard = ({ forecast }: ForecastCardProps) => (
  <Card>
    <CardContent>
      <Typography component="h2" variant="h5">
        Forecast
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {forecast
          ? `Nearest station: ${forecast.nearestStation}`
          : 'Loading nearest weather station…'}
      </Typography>
      <Divider />
      <List disablePadding>
        {forecast?.forecast.map((item) => (
          <ListItem divider key={item.datetime} sx={{ px: 0 }}>
            <ListItemText
              primary={dayjs(item.datetime).format('DD MMM YYYY, HH:mm')}
            />
            <Chip label={formatProbability(item.probability)} size="small" />
          </ListItem>
        ))}
      </List>
    </CardContent>
  </Card>
)
