import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { Meta, StoryObj } from '@storybook/react-vite'

import { SnackbarProvider } from '#/components/SnackbarProvider/SnackbarProvider'

import { Heatmap } from './Heatmap'

const meta = {
  component: Heatmap,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      return (
        <QueryClientProvider client={queryClient}>
          <SnackbarProvider>
            <Story />
          </SnackbarProvider>
        </QueryClientProvider>
      )
    },
  ],
  title: 'Routes/Heatmap',
} satisfies Meta<typeof Heatmap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    regenerateToken: 0,
  },
}
