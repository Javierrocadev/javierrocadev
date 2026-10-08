import {defineArrayMember, defineField, defineType} from 'sanity'

const translatedFields = (type: 'string' | 'text') => [
  defineField({name: 'es', title: 'Español', type, validation: (Rule) => Rule.required()}),
  defineField({name: 'en', title: 'English', type, validation: (Rule) => Rule.required()}),
]

export default defineType({
  name: 'portfolioProjects',
  title: 'Mis proyectos',
  type: 'document',
  fields: [
    defineField({
      name: 'projects',
      title: 'Proyectos',
      description: 'Arrastra los proyectos para cambiar el orden en la web. El logo utiliza el componente fijo del portfolio.',
      type: 'array',
      options: {sortable: true},
      of: [defineArrayMember({
        name: 'portfolioProject',
        title: 'Proyecto',
        type: 'object',
        fields: [
          defineField({name: 'title', title: 'Título', type: 'object', fields: translatedFields('string'), validation: (Rule) => Rule.required()}),
          defineField({name: 'description', title: 'Descripción', type: 'object', fields: translatedFields('text'), validation: (Rule) => Rule.required()}),
          defineField({
            name: 'featured',
            title: 'Destacado',
            type: 'boolean',
            initialValue: false,
            description: 'Actívalo para mostrar este proyecto en la web.',
          }),
          defineField({
            name: 'mediaType',
            title: 'Contenido visual',
            type: 'string',
            initialValue: 'image',
            options: {list: [{title: 'Imagen', value: 'image'}, {title: 'Vídeo', value: 'video'}, {title: 'Logo (componente fijo)', value: 'logo'}], layout: 'radio'},
            validation: (Rule) => Rule.required(),
          }),
          defineField({
            name: 'image', title: 'Imagen / portada del vídeo', type: 'image', options: {hotspot: true},
            hidden: ({parent}) => parent?.mediaType === 'logo',
            fields: [defineField({name: 'alt', title: 'Texto alternativo', type: 'object', fields: translatedFields('string')})],
            validation: (Rule) => Rule.custom((value, context) => (context.parent as {mediaType?: string})?.mediaType === 'image' && !value?.asset ? 'Añade una imagen.' : true),
          }),
          defineField({
            name: 'video', title: 'Vídeo', type: 'file', options: {accept: 'video/mp4,video/webm'},
            description: 'MP4 o WebM. Se muestra con controles de reproducción.',
            hidden: ({parent}) => parent?.mediaType !== 'video',
            validation: (Rule) => Rule.custom((value, context) => (context.parent as {mediaType?: string})?.mediaType === 'video' && !value?.asset ? 'Añade un vídeo.' : true),
          }),
          defineField({name: 'url', title: 'Enlace del proyecto', type: 'url', validation: (Rule) => Rule.uri({scheme: ['http', 'https']})}),
          defineField({
            name: 'categories', title: 'Etiquetas', type: 'array',
            description: 'Selecciona etiquetas creadas en «Etiquetas de proyectos».',
            of: [defineArrayMember({type: 'reference', to: [{type: 'projectCategory'}], options: {disableNew: true}})],
            validation: (Rule) => Rule.unique(),
          }),
        ],
        preview: {
          select: {title: 'title.es', subtitle: 'mediaType', media: 'image'},
          prepare({title, subtitle, media}) {
            return {title: title || 'Nuevo proyecto', subtitle: subtitle === 'logo' ? 'Logo · componente fijo' : subtitle === 'video' ? 'Vídeo' : 'Imagen', media}
          },
        },
      })],
      validation: (Rule) => Rule.custom((items) => (items || []).filter((item) => (item as {mediaType?: string})?.mediaType === 'logo').length > 1 ? 'Solo puede haber un proyecto con el componente del logo.' : true),
    }),
  ],
  preview: {prepare: () => ({title: 'Mis proyectos'})},
})
