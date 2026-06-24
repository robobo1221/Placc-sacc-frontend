import type { Meta, StoryObj } from '@storybook/react-vite'

import { AppBar } from './AppBar'

const meta = {
  component: AppBar,
  title: 'Routes/AppBar',
} satisfies Meta<typeof AppBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
