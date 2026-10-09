# User Story Status Badge Visibility

## Why

Tras agregar el selector de estado en la página *Historias*, los usuarios que pueden gestionarlo (PO/SM/ADMIN) ven **a la vez** el badge de estado y el selector, lo que es redundante: el selector ya muestra el estado actual. El badge solo aporta información a quien **no** puede usar el selector (los developers).

## What Changes

- En cada tarjeta de la página **Historias**, ocultar el **badge de estado** (`story.status`) cuando el usuario puede gestionar la historia (mismo criterio que muestra el selector: `ADMIN`, o PO/SM en el proyecto).
- El badge SHALL mostrarse únicamente a quienes **no** pueden gestionar la historia (developers / no-miembros), que no ven el selector.
- Para no perder la lectura rápida en modo manager, **colorear el propio selector** según el estado: verde cuando `COMPLETED`, gris cuando `BACKLOG`.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `user-story-management`: se agrega el requisito de visibilidad del badge de estado (solo para usuarios sin el selector) y el de color del selector según el estado, complementando el requisito del control de cambio de estado.

## Impact

- `src/pages/UserStories.tsx`: renderizado condicional del `<span>` del badge de estado con `canManageStory(...)`; helper de clases del selector según estado.
- **Sin backend, schema ni tests nuevos**: es un ajuste de visibilidad/estilo en la UI; se verifica con `tsc`/biome y la suite existente.
