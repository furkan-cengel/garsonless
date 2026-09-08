import 'server-only'
import { createDashboardMediaStagingPort, createThemeApplicationPort } from '@garsonless/db/server'
import { assertAccess } from './auth/access'
import { uploadMenuImage } from './actions/menu'
import { uploadThemeMedia, uploadThemeVideo } from './actions/theme'
import { createMediaStagingWorkflow } from './media-staging-workflow'

export function dashboardMediaStagingWorkflow() {
  return createMediaStagingWorkflow({
    port: createDashboardMediaStagingPort(),
    async authorize(kind, input) {
      const gate = await assertAccess(input.restaurantId, kind === 'menu-image' ? 'menu' : 'theme')
      if ('error' in gate) return false
      if (kind === 'theme-video' || input.purpose === 'home-hero-poster') {
        const port = createThemeApplicationPort()
        const restaurant = await port.readRestaurant({ restaurantId: input.restaurantId })
        if (!restaurant.ok || !restaurant.value) return false
        const access = await port.readFeatureAccess({ restaurantId: input.restaurantId, plan: restaurant.value.plan, feature: 'theme_video_hero' })
        return access.ok && Boolean(access.value)
      }
      return true
    },
    publish: (kind, data) => kind === 'menu-image' ? uploadMenuImage(data)
      : kind === 'theme-video' ? uploadThemeVideo(data) : uploadThemeMedia(data),
  })
}
