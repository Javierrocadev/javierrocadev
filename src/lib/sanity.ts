import {createClient} from '@sanity/client'

export const sanityClient = createClient({
  projectId: 'oq1tmoti',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})
