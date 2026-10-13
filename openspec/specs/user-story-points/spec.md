# User story points Capability

## Purpose

Lets estimators capture Story Points when creating a user story and surfaces the estimate on story cards, without blocking stories that are not yet estimated.
## Requirements
### Requirement: Campo opcional de Story Points al crear una historia
El formulario de creación de historias de usuario (`src/pages/UserStories.tsx`) SHALL incluir un campo numérico opcional "Puntos (Story Points)" que acepte enteros de 0 a 99, y SHALL enviar el valor `storyPoints` al API solo cuando el campo contenga un entero válido. Cuando el campo esté vacío o su contenido no represente un número entero, `storyPoints` SHALL omitirse del envío y persistirse como `null` ("sin estimar"); ese contenido inválido NUNCA SHALL convertirse en `0`. Un `0` escrito explícitamente SHALL enviarse como `0` y contar como una historia estimada.

#### Scenario: Crear historia con puntos
- **WHEN** el PO/SM completa el formulario con título, descripción, proyecto, prioridad y puntos = 8, y presiona Crear
- **THEN** la historia se crea con `storyPoints = 8` persistido en la base de datos

#### Scenario: Crear historia sin puntos
- **WHEN** el usuario deja el campo de puntos vacío y envía el formulario
- **THEN** la historia se crea correctamente con `storyPoints` sin valor (null) — el campo nunca bloquea la creación

#### Scenario: Contenido no numérico no se convierte en cero
- **WHEN** el campo de puntos contiene un valor que no es un entero válido (por ejemplo `.`, `-` o `+`)
- **THEN** la historia se crea con `storyPoints` sin valor (null) y la base de datos nunca recibe `0` por ese motivo

#### Scenario: Cero explícito es una estimación válida
- **WHEN** el usuario escribe explícitamente `0` en el campo de puntos y envía el formulario
- **THEN** la historia se crea con `storyPoints = 0`, contada como historia estimada

#### Scenario: Valor fuera de rango
- **WHEN** el usuario ingresa un valor negativo o mayor a 99
- **THEN** el input rechaza la entrada inválida (min/max HTML5) y el valor enviado se limita al rango 0–99

#### Scenario: Reinicio del formulario tras crear
- **WHEN** la historia se crea exitosamente
- **THEN** el campo de puntos se limpia junto con el resto del formulario

### Requirement: Visualización de Story Points en la tarjeta de historia
La lista de historias de usuario SHALL mostrar un badge con los puntos (`N pts`) cuando `storyPoints` tenga valor, y SHALL mostrar un badge neutro "Sin estimar" cuando no tenga valor. Una historia con `storyPoints = 0` SHALL mostrar `0 pts`, no "Sin estimar".

#### Scenario: Tarjeta con puntos
- **WHEN** una historia con `storyPoints = 8` se muestra en la lista
- **THEN** la tarjeta muestra un badge "8 pts"

#### Scenario: Tarjeta sin puntos muestra "Sin estimar"
- **WHEN** una historia con `storyPoints = null` se muestra en la lista
- **THEN** la tarjeta muestra un badge "Sin estimar"

#### Scenario: Tarjeta con cero puntos
- **WHEN** una historia con `storyPoints = 0` se muestra en la lista
- **THEN** la tarjeta muestra el badge "0 pts" y no "Sin estimar"

### Requirement: El tipo de dato de la historia incluye story points
El `interface UserStory` de `src/pages/UserStories.tsx` SHALL incluir el campo `storyPoints?: number | null` para reflejar la respuesta real del API.

#### Scenario: Consumo del campo en el frontend
- **WHEN** el componente recibe los datos de una historia desde `GET /api/user-stories`
- **THEN** `storyPoints` está tipado y disponible para su renderizado sin errores de TypeScript

