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
- Límite de cartas normales controlado por el servidor; ahora admite modificadores aditivos temporales.
- Dos cartas de tramo entregadas mediante una función segura; se acumulan y no consumen espacios normales.
- Actualizaciones Realtime preparadas para barajas, perfiles y notificaciones.
- Motor universal de cartas con `play_card()` en el servidor: valida objetivos, aplica efectos configurados, registra acciones y consume, conserva o transfiere cartas según su definición.
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
- Conectar `play_card()` a la interfaz y completar la integración de efectos específicos, evoluciones y giros de las ruletas especiales.
- Añadir autorización de administradores y herramientas del evento.
- Conectar el bot de Discord para operaciones administrativas y `/tramo` cuando se definan las reglas finales.

## Publicación
GitHub Pages desde la rama `main`, carpeta raíz:

https://criptor03.github.io/typelink2-ruleta/