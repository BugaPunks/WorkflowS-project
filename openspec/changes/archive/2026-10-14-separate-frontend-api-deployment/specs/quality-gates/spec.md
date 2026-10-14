# Spec Delta

## ADDED Requirements

### Requirement: El despliegue con orígenes separados está cubierto por un comando end-to-end documentado

El proyecto SHALL exponer, en `package.json`, un comando end-to-end documentado que ejecute la aplicación con el frontend y el API en orígenes distintos y verifique el comportamiento del cliente cross-origin, de modo que la separación de orígenes pueda validarse sin montaje manual.

#### Scenario: Existe un comando dedicado a la separación
- **WHEN** se inspecciona `package.json`
- **THEN** existe un comando documentado que ejecuta la suite end-to-end de separación, distinto del comando end-to-end existente

#### Scenario: La suite arranca ambos orígenes
- **WHEN** se ejecuta el comando end-to-end de separación
- **THEN** el frontend se sirve en un origen y el API en otro origen distinto antes de correr las pruebas

#### Scenario: La suite verifica el flujo cross-origin
- **WHEN** se ejecuta la suite end-to-end de separación
- **THEN** comprueba que el login se completa contra el origen del API, que la sesión viaja en las peticiones posteriores y que un documento subido se descarga desde el origen del API
