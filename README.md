# Pokémon TypeLink 2 — Plataforma (Beta 0.2)

Primera estructura de la plataforma TypeLink 2 con identidad visual inspirada en Pokémon Blanco y Negro y la región de Teselia.

## Incluye
- Navegación entre Inicio, Ruleta, Jugadores, Mi baraja, Mi equipo Pokémon, Notificaciones y Administración.
- Ruleta animada funcional conservada de la Beta 0.1.
- Cartas normales con límite de cinco.
- Cartas de tramo acumulables mediante una simulación local.
- Inventario persistente en el navegador mediante localStorage.
- Diseño adaptable a escritorio y móvil.
- Apartados informativos para las funciones que aún no están conectadas.

## Inicio de sesión (Beta 0.3 en progreso)
- Cliente Supabase JS fijado a la versión 2.119.0.
- Inicio y cierre de sesión OAuth con Discord desde la cabecera.
- Se usa la clave publishable pública de Supabase; nunca una clave secret/service_role.
- El inicio de sesión depende de que Discord esté habilitado como proveedor en el proyecto Supabase de São Paulo y que sus credenciales estén guardadas allí.
- La baraja continúa siendo local/demo hasta implementar las operaciones seguras de entrega de cartas.

## Limitaciones actuales
- No hay inicio de sesión con Discord todavía.
- No hay base de datos compartida: la baraja sigue siendo local al navegador.
- Jugadores, notificaciones y administración son apartados de estructura, no funciones conectadas.
- La importación de partidas DeSmuME y TypeLink Sync aún no están implementados.
- Las cartas son ilustraciones provisionales.

## Publicación
El sitio se publica mediante GitHub Pages desde la rama `main`, carpeta raíz.

https://github.com/Criptor03/typelink2-ruleta


## Backend Supabase

El proyecto activo está en São Paulo: `typelink2-platform-saopaulo` (`uytdmfrynuzofkyedhve`). Consulta [`docs/architecture.md`](docs/architecture.md) para el esquema, seguridad y configuración de autenticación. No guardes claves secretas en este repositorio.
