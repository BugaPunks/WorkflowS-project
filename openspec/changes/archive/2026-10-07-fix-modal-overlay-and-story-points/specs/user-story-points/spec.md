## ADDED Requirements

### Requirement: Campo opcional de Story Points al crear una historia
El formulario de creación de historias de usuario (`src/pages/UserStories.tsx`) SHALL incluir un campo numérico opcional "Puntos (Story Points)" que acepte enteros de 0 a 99, y SHALL enviar el valor `storyPoints` al API solo cuando el campo tenga contenido.

#### Scenario: Crear historia con puntos
- **WHEN** el PO/SM completa el formulario con título, descripción, proyecto, prioridad y puntos = 8, y presiona Crear
- **THEN** la historia se crea con `storyPoints = 8` persistido en la base de datos

#### Scenario: Crear historia sin puntos
- **WHEN** el usuario deja el campo de puntos vacío y envía el formulario
- **THEN** la historia se crea correctamente con `storyPoints` sin valor (null) — el campo nunca bloquea la creación

#### Scenario: Valor fuera de rango
- **WHEN** el usuario ingresa un valor negativo o mayor a 99
- **THEN** el input rechaza la entrada inválida (min/max HTML5) y el valor enviado se limita al rango 0–99

#### Scenario: Reinicio del formulario tras crear
- **WHEN** la historia se crea exitosamente
- **THEN** el campo de puntos se limpia junto con el resto del formulario

### Requirement: Visualización de Story Points en la tarjeta de historia
La lista de historias de usuario SHALL mostrar un badge con los puntos de la historia (`N pts`) cuando `storyPoints` tenga valor, y SHALL omitirlo cuando no tenga valor.

#### Scenario: Tarjeta con puntos
- **WHEN** una historia con `storyPoints = 8` se muestra en la lista
- **THEN** la tarjeta muestra un badge "8 pts"

#### Scenario: Tarjeta sin puntos
- **WHEN** una historia con `storyPoints = null` se muestra en la lista
- **THEN** la tarjeta no muestra ningún badge de puntos (sin espacio vacío ni "0 pts")

### Requirement: El tipo de dato de la historia incluye story points
El `interface UserStory` de `src/pages/UserStories.tsx` SHALL incluir el campo `storyPoints?: number | null` para reflejar la respuesta real del API.

#### Scenario: Consumo del campo en el frontend
- **WHEN** el componente recibe los datos de una historia desde `GET /api/user-stories`
- **THEN** `storyPoints` está tipado y disponible para su renderizado sin errores de TypeScript
