import { iconsPlugin, getIconCollections } from '@egoist/tailwindcss-icons'

export default {
  plugins: [iconsPlugin({ collections: getIconCollections(['svg-spinners', 'mdi']) })],
}
