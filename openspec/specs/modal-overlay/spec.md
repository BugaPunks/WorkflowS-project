# Modal overlay Capability

## Purpose

Defines the standard behavior of modal dialogs across the application: a translucent overlay compatible with Tailwind v4, consistent close interactions, and the shared `<Modal>` component as the single implementation for form modals.

## Requirements

### Requirement: Overlay de modal translúcido compatible con Tailwind v4
Todos los modales de la aplicación SHALL renderizar un overlay de fondo **translúcido** mediante el componente `<Modal>` compartido (`bg-gray-900/60` con `backdrop-blur-sm`), y MUST NOT utilizar clases `bg-opacity-*` (eliminadas en Tailwind v4, producen un fondo negro opaco).

#### Scenario: Modal con fondo translúcido
- **WHEN** el usuario abre cualquier modal (Añadir Miembro, Nuevo Sprint, Crear Historia)
- **THEN** el fondo de la página se ve oscurecido pero visible detrás del modal (translúcido con blur), nunca negro sólido

#### Scenario: Sin clases muertas de Tailwind v4
- **WHEN** se ejecuta una búsqueda en `src/` por `bg-opacity|text-opacity|border-opacity`
- **THEN** no hay coincidencias en archivos `.tsx`

### Requirement: Cierre consistente del modal
El componente `<Modal>` compartido SHALL cerrarse con la tecla Escape, con un clic sobre el overlay y con el botón ✕ del header, y SHALL mostrar el título del modal en el header.

#### Scenario: Cierre con Escape
- **WHEN** el usuario presiona Escape con un modal abierto
- **THEN** el modal se cierra

#### Scenario: Cierre con clic en el overlay
- **WHEN** el usuario hace clic fuera del contenido del modal (sobre el overlay)
- **THEN** el modal se cierra

#### Scenario: Cierre con el botón del header
- **WHEN** el usuario hace clic en el botón ✕ del header del modal
- **THEN** el modal se cierra

### Requirement: Los modales de ProjectDetail usan el componente compartido
Los modales "Añadir Miembro" y "Nuevo Sprint" de `src/pages/ProjectDetail.tsx` SHALL implementarse con el componente `<Modal>` compartido, eliminando los overlays inline `fixed inset-0 bg-black bg-opacity-50`, sin modificar la lógica de negocio (`handleAddMember`, `handleCreateSprint`).

#### Scenario: Abrir Añadir Miembro
- **WHEN** el admin hace clic en agregar un miembro desde el detalle del proyecto
- **THEN** el modal "Añadir Miembro" se muestra con el estilo estándar y el formulario funciona (seleccionar usuario y rol, enviar)

#### Scenario: Abrir Nuevo Sprint
- **WHEN** el SM o admin hace clic en crear un sprint desde el detalle del proyecto
- **THEN** el modal "Nuevo Sprint" se muestra con el estilo estándar y el formulario funciona (nombre, fechas, descripción, enviar)

#### Scenario: Enviar el formulario conserva la lógica original
- **WHEN** el usuario completa y envía cualquiera de los dos formularios
- **THEN** se ejecuta el mismo handler que antes (agregar miembro con su rol / crear sprint) y el modal se cierra al éxito
