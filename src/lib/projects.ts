import {sanityClient} from './sanity'

type TranslatedText = {es?: string; en?: string}
export interface ProjectCategory {
  id: string
  title: string
}

export interface Project {
  title: string
  description: string
  mediaType: 'image' | 'video' | 'logo'
  image: {src: string; alt: string} | null
  video: string | null
  url: string | null
  categories: ProjectCategory[]
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

const translate = (text: TranslatedText | undefined, lang: 'es' | 'en') => text?.[lang] || text?.es || text?.en || ''

export async function getProjects(lang: 'es' | 'en', {featuredOnly = true} = {}): Promise<Project[]> {
  const items = await sanityClient.withConfig({useCdn: false}).fetch<StoredProject[] | null>(`
    *[_type == "portfolioProjects" && _id == "portfolioProjects"][0].projects[!$featuredOnly || featured == true]{
      title, description, mediaType, url,
      image{"url": asset->url, alt},
      "video": video.asset->url,
      categories[]->{_id, title}
    }
  `, {featuredOnly})
  return (items || []).map((item) => ({
    title: translate(item.title, lang),
    description: translate(item.description, lang),
    mediaType: item.mediaType,
    image: item.image?.url ? {src: item.image.url, alt: translate(item.image.alt, lang) || translate(item.title, lang)} : null,
    video: item.video || null,
    url: item.url || null,
    categories: (item.categories || []).filter(Boolean).map((category) => ({id: category._id, title: translate(category.title, lang)})),
  }))
}

export async function getProjectCategories(lang: 'es' | 'en'): Promise<ProjectCategory[]> {
  const items = await sanityClient.withConfig({useCdn: false}).fetch<{_id: string; title?: TranslatedText}[]>(`
    *[_type == "projectCategory"]{_id, title}
  `)
  return items.map((item) => ({id: item._id, title: translate(item.title, lang)}))
    .sort((a, b) => a.title.localeCompare(b.title, lang))
}
