import {sanityClient} from './sanity'

type TranslatedText = {es?: string; en?: string}
export interface Project {
  title: string
  description: string
  mediaType: 'image' | 'video' | 'logo'
  image: {src: string; alt: string} | null
  video: string | null
  url: string | null
  categories: {id: string; title: string}[]
}

interface StoredProject {
  title?: TranslatedText
  description?: TranslatedText
  mediaType: Project['mediaType']
  image?: {url?: string; alt?: TranslatedText}
  video?: string
  url?: string
  categories?: {_id: string; title?: TranslatedText}[]
}

export async function getProjects(lang: 'es' | 'en'): Promise<Project[]> {
  const items = await sanityClient.withConfig({useCdn: false}).fetch<StoredProject[] | null>(`
    *[_type == "portfolioProjects" && _id == "portfolioProjects"][0].projects[featured == true]{
      title, description, mediaType, url,
      image{"url": asset->url, alt},
      "video": video.asset->url,
      categories[]->{_id, title}
    }
  `)
  const translate = (text?: TranslatedText) => text?.[lang] || text?.es || text?.en || ''
  return (items || []).map((item) => ({
    title: translate(item.title),
    description: translate(item.description),
    mediaType: item.mediaType,
    image: item.image?.url ? {src: item.image.url, alt: translate(item.image.alt) || translate(item.title)} : null,
    video: item.video || null,
    url: item.url || null,
    categories: (item.categories || []).filter(Boolean).map((category) => ({id: category._id, title: translate(category.title)})),
  }))
}
