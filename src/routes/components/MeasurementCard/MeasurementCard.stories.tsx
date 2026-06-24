import type { Meta, StoryObj } from '@storybook/react-vite'

import { MeasurementCard } from './MeasurementCard'

const meta = {
  component: MeasurementCard,
  title: 'Routes/MeasurementCard',
} satisfies Meta<typeof MeasurementCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    coordinates: { lat: 52.370216, lon: 4.895168 },
    isSubmitting: false,
    onStickyChange: () => undefined,
    onSubmit: () => undefined,
    sticky: false,
  },
}

export const Submitting: Story = {
  args: {
    ...Default.args,
    isSubmitting: true,
  },
}
