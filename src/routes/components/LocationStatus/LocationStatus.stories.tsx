import type { Meta, StoryObj } from '@storybook/react-vite'

import { LocationStatus } from './LocationStatus'

const meta = {
  component: LocationStatus,
  title: 'Routes/LocationStatus',
} satisfies Meta<typeof LocationStatus>

export default meta
type Story = StoryObj<typeof meta>

export const FindingLocation: Story = {
  args: {
    hasCaptureError: false,
    hasDataError: false,
    isLoading: true,
    locationError: null,
  },
}

export const LocationUnavailable: Story = {
  args: {
    hasCaptureError: false,
    hasDataError: false,
    isLoading: false,
    locationError: 'Allow location access to load your local forecast.',
  },
}

export const ApiError: Story = {
  args: {
    hasCaptureError: false,
    hasDataError: true,
    isLoading: false,
    locationError: null,
  },
}
