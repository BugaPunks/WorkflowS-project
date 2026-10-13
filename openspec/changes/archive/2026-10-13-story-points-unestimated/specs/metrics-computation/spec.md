## ADDED Requirements

### Requirement: Las métricas exponen el conteo de historias sin estimar
El cálculo de burndown y el de velocidad SHALL reportar, además de los totales de puntos, el número de historias del sprint sin estimar (aquellas cuyo `storyPoints` no tiene valor / es `null`). Este conteo SHALL ser informativo y NO SHALL modificar `totalPoints`, `committed` ni `completed`, que siguen tratando los puntos ausentes como `0`.

#### Scenario: Burndown cuenta las historias sin estimar
- **WHEN** un sprint tiene 2 historias, una con 5 puntos y otra sin `storyPoints`
- **THEN** el total de puntos es 5 y el conteo de historias sin estimar es 1

#### Scenario: Velocity reporta historias sin estimar por sprint
- **WHEN** un sprint tiene 3 historias y una de ellas no tiene `storyPoints`
- **THEN** su entrada de velocidad conserva `committed` y `completed` calculados como antes y reporta 1 historia sin estimar

#### Scenario: Las historias estimadas en cero no cuentan como sin estimar
- **WHEN** una historia tiene `storyPoints = 0`
- **THEN** NO se cuenta como historia sin estimar

#### Scenario: Sprint sin historias sin estimar
- **WHEN** todas las historias del sprint tienen `storyPoints` con valor
- **THEN** el conteo de historias sin estimar es 0
