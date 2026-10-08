# Studio del portfolio

Proyecto Sanity: `oq1tmoti`. Dataset: `production`.

## Mis proyectos

La sección **Mis proyectos** contiene una lista ordenable: arrastra cada proyecto para cambiar su posición en la web, incluido el logo.

Solo los proyectos con **Destacado** activado aparecen en la web. Los nuevos proyectos empiezan con este campo desactivado.

Cada proyecto tiene título y descripción en español e inglés, enlace opcional y contenido visual: imagen, vídeo MP4/WebM con portada opcional, o el componente fijo del logo. El código del logo se conserva en `src/components/Sections/LogoCard.astro`; Sanity solo elige ese componente, sin almacenar ni ejecutar código.

En **Etiquetas de proyectos** se define el catálogo de categorías con nombres en ambos idiomas. En cada proyecto solo se seleccionan referencias a ese catálogo.

## Desarrollo y despliegue

Desde esta carpeta, instala las dependencias e inicia sesión:

```sh
npm ci
npx sanity login
```

La web consulta los proyectos publicados directamente en Sanity, sin datos locales de respaldo.

```sh
npm run dev
npm run build
npm run deploy
```

Publica los cambios en Studio y vuelve a compilar/desplegar el portfolio para que se reflejen en sus páginas estáticas. Si utilizas un Studio alojado en Sanity, despliega también el Studio al cambiar los esquemas.
