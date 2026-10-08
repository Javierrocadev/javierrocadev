import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'projectCategory',
  title: 'Etiquetas de proyectos',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Nombre',
      type: 'object',
      fields: [
        defineField({name: 'es', title: 'Español', type: 'string', validation: (Rule) => Rule.required()}),
        defineField({name: 'en', title: 'English', type: 'string', validation: (Rule) => Rule.required()}),
      ],
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {select: {title: 'title.es', subtitle: 'title.en'}},
})
