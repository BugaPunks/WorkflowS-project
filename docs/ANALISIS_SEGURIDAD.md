# Análisis de Seguridad — WorkflowS

**Fecha:** 2026-07-03  
**Alcance:** Backend (`src/server/`), Frontend (`src/auth/`, `src/hooks/`, `src/api/`), Configuración, Dependencias

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|:--------:|
| 🔴 Críticas | 4 |
| 🟠 Altas | 6 |
| 🟡 Medias | 6 |
| 🟢 Bajas | 4 |
| **Total** | **20** |

El hallazgo más grave es la **ausencia total de autenticación y autorización en el backend**: el servidor genera JWTs pero nunca los valida. Cualquier persona con la URL del servidor puede ejecutar operaciones CRUD sobre cualquier recurso sin restricción.

---

## 🔴 Críticas

### C-1: Sin autenticación en ninguna ruta

**Ubicación:** `src/server/routes/*.ts` (13 archivos)

No existe un middleware de verificación JWT. El token se genera correctamente en `POST /api/auth/login` (`auth.ts:111-119`) pero **jamás se valida en ninguna petición subsecuente**. Todos los endpoints son públicos.

**Impacto:** Cualquier atacante con acceso a la red puede ejecutar cualquier operación: crear/borrar proyectos, tareas, usuarios, evaluaciones, acceder a mensajes y archivos.

**Archivos afectados:**
- `auth.ts`, `users.ts`, `projects.ts`, `sprints.ts`, `tasks.ts`
- `user-stories.ts`, `chat.ts`, `documents.ts`, `evaluations.ts`
- `rubrics.ts`, `metrics.ts`, `notifications.ts`, `retrospectives.ts`

---

### C-2: Sin autorización (RBAC) en el backend

**Ubicación:** `src/server/routes/*.ts`

El frontend define permisos por rol en `src/hooks/useSession.tsx:76-106`, pero el backend nunca verifica qué rol tiene el usuario ni si está autorizado para una acción concreta.

**Impacto:** Un usuario con rol `TEAM_DEVELOPER` puede eliminar proyectos, gestionar usuarios, crear rúbricas, borrar sprints, etc.

---

### C-3: JWT_SECRET hardcodeado como fallback

**Ubicación:** `src/server/routes/auth.ts:7`

```typescript
const JWT_SECRET = process.env.JWT_SECRET || "default_secret_key";
```

Si la variable de entorno `JWT_SECRET` no está definida, todos los tokens se firman con la clave conocida `"default_secret_key"`.

**Impacto:** Permite forjar tokens JWT arbitrarios y autenticarse como cualquier usuario del sistema.

---

### C-4: Registro permite autoasignarse rol ADMIN

**Ubicación:**
- `src/auth/RegisterForm.tsx:206-209` — el selector incluye `ADMIN`
- `src/server/routes/auth.ts:13` — el backend acepta el rol del body sin validación

```typescript
const { name, email, password, role = "TEAM_DEVELOPER" } = req.body;
```

**Impacto:** Cualquier persona puede registrarse como administrador, obteniendo control total del sistema (gestión de usuarios, borrado de proyectos, etc.).

---

## 🟠 Altas

### A-1: Mass Assignment (inyección de campos)

**Ubicación:**
- `src/server/routes/sprints.ts:85` — `data: req.body`
- `src/server/routes/projects.ts:111` — `...rest` (spread de req.body)
- `src/server/routes/tasks.ts:106` — `...updateData` (spread de req.body)
- `src/server/routes/user-stories.ts:82` — spread de req.body

**Ejemplo (`sprints.ts`):**
```typescript
await prisma.sprint.update({
  where: { id: req.params.id },
  data: req.body, // <-- el cliente puede enviar cualquier campo
});
```

**Impacto:** Un atacante puede modificar campos que no debería (ej: `projectId`, `id` del modelo) al enviar datos adicionales en el body de la petición.

---

### A-2: Contraseñas en texto plano en logs

**Ubicación:** `src/server/routes/auth.ts:12`

```typescript
console.log("Register body:", req.body);
```

Esto imprime la contraseña sin hashear en la consola del servidor.

**Impacto:** Exposición de credenciales en logs del servidor, accesibles a quien tenga acceso a la terminal o sistemas de logging.

---

### A-3: Endpoint de usuarios devuelve hash de contraseña

**Ubicación:** `src/server/routes/users.ts:29-37`

```typescript
const user = await prisma.user.findUnique({
  where: { id: req.params.id },
  include: { projects: true, tasks: true },
  // Falta 'select' para excluir el campo password
});
res.json({ data: user });
```

El `GET /api/users/:id` retorna todos los campos del usuario incluyendo el hash de bcrypt.

**Impacto:** Un atacante puede obtener los hashes de contraseñas de todos los usuarios y potencialmente crackearlos offline.

---

### A-4: Sin rate limiting en login

**Ubicación:** `src/server/routes/auth.ts:80-135`

El endpoint `POST /api/auth/login` no implementa límite de intentos por IP ni por usuario.

**Impacto:** Permite ataques de fuerza bruta contra credenciales de usuarios.

---

### A-5: Sin helmet / headers de seguridad HTTP

**Ubicación:** `src/server/index.ts:30-31`

```typescript
app.use(cors());
app.use(express.json());
```

No se usan headers de seguridad como:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`

**Impacto:** Expone la aplicación a clickjacking, MIME sniffing, y otras vulnerabilidades del lado del cliente.

---

### A-6: Sin límite de tamaño ni validación de tipo en uploads

**Ubicación:** `src/server/routes/documents.ts:18`

```typescript
const upload = multer({ storage });
```

Sin `limits.fileSize` ni `fileFilter` para restringir tipos de archivo.

**Impacto:** DoS por subida de archivos muy grandes. Subida de archivos ejecutables (.exe, .html con scripts) que luego se sirven desde `/uploads` sin autenticación.

---

## 🟡 Medias

### M-1: CORS abierto a cualquier origen

**Ubicación:** `src/server/index.ts:30`

```typescript
app.use(cors());
```

Sin opciones, permite peticiones desde cualquier dominio en producción.

---

### M-2: Sesión en localStorage (vulnerable a XSS)

**Ubicación:** `src/hooks/useSession.tsx:25,53`

Los datos de sesión (id, nombre, email, rol) se persisten en `localStorage`. Aunque la contraseña se filtra, un XSS en la aplicación permitiría robar la sesión.

---

### M-3: Sin sanitización de entrada contra XSS

**Ubicación:** Todos los endpoints que reciben texto (titles, descriptions, messages, feedback, comments)

Los datos se almacenan y sirven sin sanitización. Un atacante puede almacenar HTML/JavaScript malicioso que se ejecute en los navegadores de otros usuarios.

---

### M-4: Sin protección CSRF

**Ubicación:** General

La aplicación no implementa tokens CSRF ni configura cabeceras anti-CSRF. Como el estado es stateless (JWT en body de respuesta, no en cookies), el riesgo es menor pero no nulo si el token se almacena de forma accesible.

---

### M-5: Detalles de error expuestos al cliente

**Ubicación:** Múltiples archivos (`auth.ts:74`, `projects.ts:34,99`, `sprints.ts:75,93,135`, `tasks.ts:215`, `evaluations.ts:210`, etc.)

```typescript
res.status(500).json({
  error: "Error al ...",
  details: error instanceof Error ? error.message : "Unknown error",
});
```

**Impacto:** Filtra información interna del servidor (rutas, estructura de datos, trazas de stack) al cliente.

---

### M-6: Export CSV vulnerable a CSV Injection (Formula Injection)

**Ubicación:** `src/server/routes/metrics.ts:197`

```typescript
rows.push(`${sprint.name},"${task.title}",...`);
```

No se escapan caracteres especiales como `=`, `+`, `-`, `@` que Excel/Sheets interpretan como fórmulas.

---

## 🟢 Bajas

### B-1: Archivos estáticos servidos sin autenticación

**Ubicación:** `src/server/index.ts:34`

```typescript
app.use("/uploads", express.static("uploads"));
```

Cualquier persona que conozca la URL de un archivo puede descargarlo.

---

### B-2: Política de contraseñas débil

**Ubicación:** `src/server/routes/auth.ts:27`

```typescript
if (password.length < 6) {
```

Mínimo de 6 caracteres, sin requisitos de complejidad (mayúsculas, números, símbolos).

---

### B-3: Sin verificación de email

**Ubicación:** `src/server/routes/auth.ts`

El registro solo valida formato de email con regex básico. No hay confirmación por correo ni verificación de propiedad.

---

### B-4: Sin HTTPS forzado

**Ubicación:** `src/server/index.ts`

No hay redirección HTTP → HTTPS ni configuración de TLS. Las credenciales viajan en texto plano si no hay un proxy reverso configurado externamente.

---

## Buenas Prácticas Presentes

A pesar de los hallazgos anteriores, el proyecto implementa correctamente:

| Práctica | Ubicación |
|----------|-----------|
| Hashing de contraseñas con bcrypt (salt rounds = 10) | `auth.ts:43`, `users.ts:52` |
| Uso de Prisma ORM (previene SQL injection) | `db.ts` |
| Transacciones atómicas en operaciones críticas | `tasks.ts:172`, `evaluations.ts:174` |
| Selección explícita de campos sensibles en consultas (evita leaks) | `auth.ts:54-59`, `projects.ts:23-25` |
| .env en .gitignore (secretos no commiteados) | `.gitignore:23` |

---

## Checklist de Mitigación Recomendada

1. **Implementar middleware JWT** que verifique el token en todas las rutas protegidas
2. **Agregar middleware de autorización** que valide permisos según el rol
3. **Mover JWT_SECRET** a variable de entorno sin fallback hardcodeado
4. **Eliminar ADMIN del selector de registro** y validar rol permitido en backend
5. **Usar `select` explícito** en consultas de usuarios para excluir el campo password
6. **Sanitizar entradas** con una librería como DOMPurify (frontend) o validación estricta en backend
7. **Agregar `helmet`** para headers de seguridad HTTP
8. **Configurar rate limiting** en login (express-rate-limit)
9. **Configurar multer** con `limits.fileSize` y `fileFilter`
10. **Eliminar logs de cuerpos de petición** que contengan contraseñas
11. **Eliminar detalles de error** en respuestas para producción
12. **Escapar caracteres en CSV** exportado
