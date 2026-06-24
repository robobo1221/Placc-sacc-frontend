import { Toolbar, Typography } from '@mui/material'

export const AppBar = () => {
  return (
    <Toolbar disableGutters>
      <Typography
        variant="h6"
        noWrap
        component="div"
        sx={{ mr: 2, display: { xs: 'none', md: 'flex' } }}
      >
        Weather App
      </Typography>
    </Toolbar>
  )
}
