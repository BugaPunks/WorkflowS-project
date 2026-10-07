## 1. Modales de ProjectDetail → componente compartido

- [x] 1.1 Migrar el modal "Añadir Miembro" (`src/pages/ProjectDetail.tsx` ~línea 582) al componente `<Modal>`: importarlo, envolver el formulario, eliminar el overlay inline `fixed inset-0 bg-black bg-opacity-50` y el padding interno redundante (Modal ya aplica `p-6`), conservando `handleAddMember` y sus estados sin cambios
- [x] 1.2 Migrar el modal "Nuevo Sprint" (`src/pages/ProjectDetail.tsx` ~línea 1201) al componente `<Modal>` de la misma forma, conservando `handleCreateSprint` y `sprintForm` sin cambios
- [x] 1.3 Verificar que no queden clases muertas de Tailwind v4 en `src/` (grep `bg-opacity|text-opacity|border-opacity` sin resultados)

## 2. Story Points en historias de usuario

- [x] 2.1 Agregar `storyPoints?: number | null` al `interface UserStory` y `storyPoints: ""` al `formData` en `src/pages/UserStories.tsx`
- [x] 2.2 Agregar input numérico "Puntos (Story Points)" (opcional, `min=0`, `max=99`, `step=1`) en el modal de creación, junto al selector de Prioridad
- [x] 2.3 En `handleCreateStory`, convertir el string a número solo si no está vacío (clamp 0–99) y enviar `storyPoints` solo cuando tenga valor; limpiar el campo en el `setFormData` posterior a crear
- [x] 2.4 Mostrar badge "N pts" en la tarjeta de la historia cuando `storyPoints != null`, sin badge cuando sea null

## 3. Verificación

- [x] 3.1 Ejecutar `npm run check` (Biome) y corregir cualquier hallazgo nuevo
- [x] 3.2 Ejecutar `npm run test` (unit tests) y confirmar que pasan
- [x] 3.3 Prueba manual: como admin, abrir "Añadir Miembro" → fondo translúcido con blur (no negro), formulario envía correctamente (confirmado por el usuario en sesión 2026-10-07)
- [ ] 3.4 Prueba manual: como SM/admin, abrir "Nuevo Sprint" → fondo translúcido, creación exitosa
- [ ] 3.5 Prueba manual: como PO, crear una historia con puntos (ej. 8) → aparece el badge "8 pts" y en la DB `user_stories.storyPoints = 8`; crear otra sin puntos → sin badge y `storyPoints = NULL`
