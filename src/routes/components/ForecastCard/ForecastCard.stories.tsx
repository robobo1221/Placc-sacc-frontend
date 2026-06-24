import type { Meta, StoryObj } from '@storybook/react-vite'

import { ForecastCard } from './ForecastCard'

const meta = {
  component: ForecastCard,
  title: 'Routes/ForecastCard',
} satisfies Meta<typeof ForecastCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    forecast: {
      nearestStation: 'Groningen',
      forecast: [
        { datetime: '2026-06-25T09:00:00+02:00', probability: 0.15 },
        { datetime: '2026-06-25T12:00:00+02:00', probability: 0.42 },
        { datetime: '2026-06-25T15:00:00+02:00', probability: 0.68 },
      ],
    },
  },
}

export const Loading: Story = {
  args: {},
}
