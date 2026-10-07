## Why

Durante la prueba del flujo Scrum se detectaron dos defectos: (1) los modales "Añadir Miembro" y "Nuevo Sprint" de `ProjectDetail.tsx` muestran un fondo **negro opaco** en lugar de translúcido, porque usan la clase `bg-opacity-50` que fue eliminada en Tailwind CSS v4 (`bg-black` queda sin opacidad → overlay sólido); (2) el modal de creación de historias de usuario no ofrece el campo **Story Points**, por lo que todas las historias se guardan con `storyPoints = NULL` a pesar de que el backend sí lo soporta.

## What Changes

- **Corrección de overlay (bug visual):** eliminar las clases muertas `bg-opacity-50` y migrar los dos modales inline de `ProjectDetail.tsx` (Añadir Miembro y Nuevo Sprint) al componente `<Modal>` compartido, unificando comportamiento: overlay translúcido con blur, cierre con ESC y clic fuera, header con botón cerrar y scroll interno.
- **Story Points en historias de usuario:** agregar campo numérico opcional "Puntos (Story Points)" al formulario de creación en `UserStories.tsx`, mostrar los puntos como badge en la tarjeta de cada historia, y reflejarlos en el `interface UserStory`.
- Sin cambios de backend: `POST /api/user-stories` ya acepta `storyPoints` (schema zod).

## Capabilities

### New Capabilities
- `modal-overlay`: Comportamiento estándar de modales de la aplicación — overlay translúcido (`bg-gray-900/60` + blur) compatible con Tailwind v4, cierre con ESC/clic en el overlay, header con título y botón cerrar; todos los modales de formularios usan el componente compartido.
- `user-story-points`: Captura y visualización de Story Points al crear historias de usuario — campo numérico opcional (0–99) en el modal de creación, persistencia vía API existente y display de badge "N pts" en las tarjetas.

### Modified Capabilities

## Impact

- **Archivos:** `src/pages/ProjectDetail.tsx` (modales de Añadir Miembro y Nuevo Sprint → `<Modal>`), `src/pages/UserStories.tsx` (formData, modal, tarjetas), `src/components/Modal.tsx` (sin cambios esperados, solo reutilización).
- **Backend:** sin cambios.
- **Dependencias:** ninguna nueva (Tailwind v4 ya instalado).
- **Riesgo:** bajo — cambio de UI pura; la lógica de `handleAddMember` y `handleCreateSprint` no se modifica.
