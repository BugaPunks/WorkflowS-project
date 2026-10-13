# Spec Delta

## ADDED Requirements

### Requirement: Identidad del JWT en resúmenes de dashboard

`GET /api/users/:id/dashboard-summary` y `PUT /api/users/:id/dashboard` SHALL usar el `userId` del token para el usuario no-admin (el parámetro `:id` solo es efectivo para `ADMIN`). Un no-admin SHALL recibir `200` con sus propios datos aunque el parámetro de ruta pertenezca a otro usuario, y el `PUT` SHALL guardar la configuración del usuario autenticado, nunca la de otro.

#### Scenario: No-admin consulta su propio resumen
- **WHEN** un usuario no-admin solicita su propio `dashboard-summary`
- **THEN** la API responde `200` con sus datos

#### Scenario: No-admin con id de otro usuario
- **WHEN** un usuario no-admin solicita el `dashboard-summary` de otro usuario
- **THEN** la API responde `200` con sus propios datos (el parámetro se ignora)

#### Scenario: ADMIN consulta el resumen de otro
- **WHEN** un `ADMIN` solicita el `dashboard-summary` de otro usuario
- **THEN** la API responde `200` con los datos de ese usuario