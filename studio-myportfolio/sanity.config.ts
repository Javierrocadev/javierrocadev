import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'MyPortfolio',

  projectId: 'oq1tmoti',
  dataset: 'production',

  plugins: [structureTool({
    structure: (S) => S.list().title('Portfolio').items([
      S.listItem().title('Mis proyectos').id('portfolioProjects').child(
        S.document().schemaType('portfolioProjects').documentId('portfolioProjects').title('Mis proyectos'),
      ),
      ...S.documentTypeListItems().filter((item) => item.getId() !== 'portfolioProjects'),
    ]),
  }), visionTool()],

  document: {
    newDocumentOptions: (options) => options.filter((option) => option.templateId !== 'portfolioProjects'),
    actions: (actions, context) => context.schemaType === 'portfolioProjects'
      ? actions.filter((action) => action.action !== 'duplicate' && action.action !== 'delete')
      : actions,
  },

  schema: {
    types: schemaTypes,
  },
})
