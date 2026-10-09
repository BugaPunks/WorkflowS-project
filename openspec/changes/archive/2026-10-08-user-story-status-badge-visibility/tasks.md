# Tasks — User Story Status Badge Visibility

## 1. Frontend (UserStories.tsx)

- [x] 1.1 Envolver el `<span>` del badge de estado en `{!canManageStory(story, user, projects) && (...)}` para mostrarlo solo a quienes no ven el selector

## 2. Verificación

- [x] 2.1 `npm run lint` (biome) y `tsc` limpios (solo los errores preexistentes)
- [x] 2.2 Suite `npm run test` verde (sin cambios de tests)
- [x] 2.3 Prueba manual: como PO/SM/ADMIN se ve el selector y **no** el badge; como dev se ve el badge y **no** el selector

## 3. Color del selector según estado

- [x] 3.1 Agregar el helper `statusSelectClassName(status)` (verde para `COMPLETED`, gris para el resto) y aplicarlo al `<select>`
- [x] 3.2 `biome` + `tsc` + `npm run test` verdes
- [x] 3.3 Prueba manual: el selector se ve verde con la HU completada y gris con la HU en backlog
