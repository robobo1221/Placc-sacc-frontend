import type { Meta, StoryObj } from '@storybook/react-vite'

import { CurrentProbabilityCard } from './CurrentProbabilityCard'

const meta = {
  component: CurrentProbabilityCard,
  title: 'Routes/CurrentProbabilityCard',
} satisfies Meta<typeof CurrentProbabilityCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    probability: 0.4287,
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}
