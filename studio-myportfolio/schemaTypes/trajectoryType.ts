import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'trajectory',
  title: 'Trajectory',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'object',
      fields: [
        {name: 'es', title: 'Español', type: 'string'},
        {name: 'en', title: 'English', type: 'string'},
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle',
      type: 'object',
      fields: [
        {name: 'es', title: 'Español', type: 'string'},
        {name: 'en', title: 'English', type: 'string'},
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'number',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'featured',
      title: 'Destacado',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'object',
      fields: [
        {name: 'es', title: 'Español', type: 'text'},
        {name: 'en', title: 'English', type: 'text'},
      ],
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      titleEs: 'title.es',
      titleEn: 'title.en',
      subtitleEs: 'subtitle.es',
      subtitleEn: 'subtitle.en',
    },
    prepare({titleEs, titleEn, subtitleEs, subtitleEn}) {
      return {
        title: titleEs || titleEn || 'Sin titulo',
        subtitle: subtitleEs || subtitleEn || '',
      }
    },
  },
})
