# Pokémon TypeLink 2 — Plataforma (Beta 0.3)

Plataforma web de TypeLink 2 con identidad visual inspirada en Pokémon Blanco y Negro y la región de Teselia.

## Incluye
- Navegación: Inicio, Ruleta, Jugadores, Mi perfil, Mi baraja, Mi equipo Pokémon, Notificaciones y Administración.
- Inicio de sesión OAuth con Discord mediante Supabase Auth.
- Perfil de entrenador creado automáticamente desde la identidad autenticada de Discord.
- Nombre público de entrenador editable y avatar asociado a Discord.
- Directorio de jugadores registrados y perfiles públicos.
- Barajas persistentes en Supabase, visibles para los participantes autenticados.
- Ruleta que solicita una carta aleatoria al backend y guarda la recompensa en la base de datos.
- Editor privado de ruletas Normal, Legendaria y Fiesta, conectado al catálogo: permite incluir/quitar cartas, activar apariciones y ajustar pesos de probabilidad.
- El sorteo de la ruleta Normal usa las cartas activas y sus pesos configurados en el editor.
- Las cartas-ticket Legenleta y Rumba aparecen en la ruleta Normal; al canjearlas entregan 1 acceso a la Ruleta Legendaria y Fiesta, respectivamente.
- Las ruletas Legendaria y Fiesta ya tienen su motor de acceso y giro: el servidor valida el pase, usa los pesos configurados y descuenta exactamente un crédito por premio. Los premios de esas ruletas se podrán añadir desde el catálogo cuando estén diseñados.
- Límite de cartas normales controlado por el servidor; ahora admite modificadores aditivos temporales.
- Dos cartas de tramo entregadas mediante una función segura; se acumulan y no consumen espacios normales.
- Actualizaciones Realtime preparadas para barajas, perfiles y notificaciones.
- Motor universal de cartas con `play_card()` y `evolve_card()` en el servidor.
- Cada carta admite de 1 a 99 usos configurables; el inventario muestra los usos restantes y agota la carta al llegar a cero.
- Evoluciones de una sola carta a otra: consumen la instancia original y entregan una nueva, sin fusiones.
- La baraja permite usar, transferir y evolucionar cartas cuando tienen efectos o reglas configuradas.
- Editor administrativo de efectos y evoluciones: configura modificadores del límite de baraja, giros extra, accesos a ruletas y evoluciones manuales o automáticas al avanzar de tramo.
- El catálogo incluye un control general de elegibilidad para ruletas; las cartas con evolución activa quedan excluidas automáticamente y no pueden añadirse a ninguna ruleta.
- Los objetivos de carta se simplificaron a dos opciones seguras: quien la utiliza o un rival.
- El catálogo conserva `image_path` para mantener cada carta vinculada a su ilustración; las imágenes provisionales actuales se sustituirán por el arte definitivo sin rehacer las mecánicas.
- Diseño adaptable a escritorio y móvil.

## Backend Supabase
Proyecto activo: `typelink2-platform-saopaulo` (`uytdmfrynuzofkyedhve`, región `sa-east-1`).

Consulta [`docs/architecture.md`](docs/architecture.md) para el esquema, políticas RLS, funciones y configuración OAuth.

## Seguridad
- Las tablas públicas de la API tienen RLS activado.
- El navegador utiliza únicamente la clave publishable de Supabase.
- No se deben guardar claves secretas de Supabase ni el Client Secret de Discord en este repositorio.
- La entrega de cartas se realiza mediante funciones SQL autorizadas únicamente al rol `authenticated`; el servidor valida la sesión y el límite de cartas.
- Los participantes pueden leer perfiles y barajas públicas, pero no pueden insertar ni modificar directamente las cartas de inventario.
- Las notificaciones son privadas para su destinatario.

## Pendiente
- Sustituir las ocho cartas provisionales por el catálogo y las imágenes definitivas de TypeLink 2.
- Conectar importador de partidas Pokémon Blanco/Negro y TypeLink Sync.
- Configurar los efectos y las reglas de evolución definitivas para el catálogo aprobado, y completar los giros especiales de las ruletas legendaria y Fiesta.
- Añadir autorización de administradores y herramientas del evento.
- Conectar el bot de Discord para operaciones administrativas y `/tramo` cuando se definan las reglas finales.

## Publicación
GitHub Pages desde la rama `main`, carpeta raíz:

https://criptor03.github.io/typelink2-ruleta/

### Avance de tramo y actividad comunitaria
Cada avance de tramo entrega 2 cartas de tramo y 3 giros normales, solo cuando hay 3 espacios libres y no quedan giros pendientes. Los efectos especiales pueden sumar giros extra con `tramo_spin_credit` (por ejemplo, +5), sin superar el límite de cartas. El muro de cartas muestra en directo giros, usos, transferencias, evoluciones y avances.


### Migraciones recientes
- `20261113042149_start_tramos_activity_feed_and_spin_credits`
- `20261113042841_remove_duplicate_card_activity_feed_index`

- `20261113043124_grant_authenticated_tramo_engine_execution`


### Perfil del entrenador
El perfil incluye un registro persistente de los 18 tipos Pokémon (habilitado/bloqueado) y un panel de cartas lanzadas por otros entrenadores que mantienen efectos activos. Los efectos con límite de tramo se limpian al llegar a su frontera; los permanentes, temporales y por cargas conservan su duración.

### Migración reciente
- `20261113175916_add_trainer_type_tracker_and_incoming_effects`


### Acceso de administración
El menú y el panel de administración se muestran únicamente cuando Supabase valida que la cuenta autenticada está en la lista privada de administradores. La primera cuenta autorizada es la del propietario del proyecto, identificada por su UUID de Supabase Auth, no por su nombre o correo. Las herramientas de gestión se irán habilitando por módulos.
