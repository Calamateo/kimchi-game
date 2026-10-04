# Plan: Juegos de mesa en línea para dos

Página web privada para jugar juegos de estrategia clásicos entre dos personas.
Solo existen dos cuentas. No hay modo contra la computadora. Uno de los dos
jugadores está empezando desde cero, así que la ayuda y las guías son parte
central del producto, no un extra.

Dispositivos prioritarios: iPhone 15 e iPad (Safari). También computadora.

---

## 1. Decisiones de arquitectura

### Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Despliegue directo en Vercel, PWA sencilla, rutas de API si hacen falta después. |
| UI | Tailwind CSS + componentes propios | Control total del tablero táctil. Sin librerías pesadas de UI. |
| Estado en tiempo real | Supabase: Postgres + Realtime + Auth | Ya lo tienes. Resuelve persistencia, sincronización y login en un solo servicio. |
| Lógica de juego | Motores puros en TypeScript (`lib/games/*`) | Funciones deterministas, serializables, testeables con Vitest. |
| Ajedrez | librería `chess.js` | Reimplementar enroque, al paso, jaque mate y tablas es fuente de bugs. |
| Tests | Vitest (motores) + Playwright (flujo básico) | Las reglas mal implementadas frustran mucho a quien está aprendiendo. |
| Hosting | Vercel (Hobby) | Gratis para uso personal. Preview URLs para probar en el iPhone. |

### Cómo se conectan los dos jugadores

**Decisión: Postgres como fuente de verdad + Supabase Realtime para avisar cambios.**

Opciones consideradas:

1. **WebRTC entre navegadores**: descartado. Requiere que ambos estén conectados
   al mismo tiempo, falla con NAT de celular, y se pierde todo si uno cierra la app.
2. **Supabase Realtime Broadcast (solo mensajes, sin guardar)**: descartado como
   mecanismo principal. iOS suspende Safari en segundo plano y corta el WebSocket.
   Al volver, no habría forma de recuperar la partida.
3. **Postgres + Realtime (elegido)**: cada jugada se guarda como fila. Ambos
   clientes se suscriben a cambios de la partida. Si alguien cierra la app, al
   volver carga el estado desde la base y sigue. Permite jugar también de forma
   asíncrona (una jugada ahora, la otra en una hora), que es lo normal en celular.

Complementos:

- **Presence** (canal de Realtime por partida) para mostrar "en línea",
  "está pensando" y "está viendo el tablero". Es efímero, no se guarda.
- **Broadcast** solo para cosas que no importa perder: reacciones con emoji,
  resaltado de "mira esta casilla".

Flujo de una jugada:

1. El jugador toca pieza y destino. El motor local valida la jugada.
2. Se llama a una función RPC `make_move(game_id, expected_ply, move, new_state)`.
   La función verifica en el servidor que `ply` coincide (evita jugadas dobles o
   fuera de turno), inserta en `moves` y actualiza `games.state` en una sola
   transacción.
3. Realtime notifica al otro cliente, que aplica el nuevo estado.
4. Al reconectar (evento `visibilitychange` u `online`), el cliente recarga la
   partida completa y vuelve a suscribirse. Nunca confía solo en el WebSocket.

### Autenticación

Solo dos usuarios. Opción más simple y segura:

- Supabase Auth con correo y contraseña.
- Las dos cuentas se crean manualmente desde el panel de Supabase.
- Registro público desactivado.
- Sesión persistente: se inicia sesión una vez por dispositivo y ya.
- Enlace mágico por correo como respaldo si alguien olvida la contraseña.
- Las políticas RLS solo permiten leer y escribir filas donde `auth.uid()` sea
  uno de los dos jugadores de la partida.

Nota iOS: la PWA instalada en pantalla de inicio tiene almacenamiento separado
de Safari. Hay que iniciar sesión una vez dentro de la PWA instalada.

---

## 2. Modelo de datos (Supabase)

```
profiles        id (= auth.users.id), display_name, avatar, settings jsonb
                -- settings: { guide_mode: bool, show_hints: bool, theme: string }

games           id, type text ('tictactoe'|'connect4'|'checkers'|'reversi'|'chess'),
                status text ('active'|'finished'|'abandoned'),
                player_a uuid, player_b uuid,
                first_player uuid,        -- quién empieza; se alterna partida a partida
                turn uuid,                -- de quién es el turno ahora
                ply int default 0,        -- número de jugadas aplicadas
                state jsonb,              -- snapshot del estado actual del motor
                winner uuid null, result text null ('win'|'draw'|'resign'),
                created_at, updated_at

moves           id, game_id, ply int, player_id, move jsonb, created_at
                UNIQUE (game_id, ply)     -- evita duplicados y condiciones de carrera

undo_requests   id, game_id, requested_by, status ('pending'|'accepted'|'rejected'), created_at

messages        id, game_id, sender, kind ('emoji'|'text'), body text, created_at
                -- opcional, fase 3
```

- `state` guarda el snapshot para cargar rápido; `moves` guarda el historial
  para repetir la partida, deshacer y aprender.
- Realtime activado en `games`, `moves` y `undo_requests`.
- RLS en todas las tablas: `auth.uid() in (player_a, player_b)`.

---

## 3. Interfaz común de los juegos

Cada juego vive en `lib/games/<nombre>/` e implementa:

```ts
interface GameEngine<S, M> {
  id: string;                 // 'checkers'
  name: string;               // 'Damas'
  initialState(): S;
  legalMoves(state: S, player: Player): M[];
  applyMove(state: S, move: M): S;
  status(state: S): { kind: 'playing' } | { kind: 'win'; winner: Player } | { kind: 'draw' };
  explainIllegal?(state: S, from: Cell, to: Cell): string;   // "No puedes mover ahí porque..."
  suggest?(state: S, player: Player): { move: M; reason: string }; // pista sencilla
}
```

Y aparte: `Board.tsx` (render táctil), `rules.md` (reglas en español claro) y
`tutorial.ts` (pasos guiados).

Los motores son funciones puras sin dependencia de React ni de Supabase. Así se
prueban en Vitest con cientos de casos y se reutilizan para el tutorial.

---

## 4. Juegos y orden sugerido

Ordenados de más fácil a más difícil para quien empieza. El orden también es el
orden de implementación, porque cada uno reutiliza la infraestructura del anterior.

| # | Juego | Tablero | Por qué en este orden |
|---|---|---|---|
| 1 | Gato (tres en línea) | 3x3 | Sirve para probar toda la infraestructura (login, lobby, realtime, turnos) con reglas triviales. |
| 2 | Conecta 4 | 7x6 | Introduce "pensar una jugada adelante" sin reglas de movimiento. |
| 3 | Damas | 8x8 | Primer juego "de verdad". Variante inglesa/americana: la dama solo avanza una casilla en diagonal, captura obligatoria. Es la variante con menos reglas. |
| 4 | Reversi (Othello) | 8x8 | Reglas en una oración, estrategia profunda. Muy bueno para aprender a ver el tablero completo. |
| 5 | Ajedrez | 8x8 | El más complejo. Se introduce con mini-lecciones (solo peones, luego torres, etc.) antes de la partida completa. |
| 6+ | Candidatos después | Mancala, Backgammon, Dominó, Dots and Boxes | Según gusten. |

---

## 5. Sistema de ayuda (lo más importante)

La ayuda se activa por jugador, no por partida. Cada quien decide en su perfil
qué tanto apoyo quiere ver. El otro no ve las pistas del compañero.

### Siempre disponible

- **Casillas legales resaltadas** al tocar una pieza. Es lo mínimo indispensable.
- **Explicación al tocar una casilla no válida**: "Esa pieza solo se mueve en
  diagonal hacia adelante". Nunca un simple "movimiento inválido".
- **Capturas obligatorias señaladas** (damas): si hay que capturar, solo esas
  piezas se pueden seleccionar y se explica por qué.
- **Panel de reglas rápidas** desde el tablero, en español sencillo, con dibujos.
  Glosario: "dama", "coronar", "jaque", etc.
- **Indicador de turno** grande y claro: "Tu turno" / "Esperando a Ana".

### Modo guía (activable)

- **Tutorial interactivo** por juego: pasos con tablero real, casillas
  parpadeando, "toca esta pieza", "ahora toca aquí". Se puede repetir cuando sea.
- **Pista** (botón "Sugerencia"): el motor propone una jugada decente con una
  razón corta ("Esta captura es segura", "Protege tu esquina"). Para damas y
  reversi un minimax de 2 niveles basta. Para ajedrez se puede usar una
  evaluación simple o stockfish.wasm más adelante.
- **Avisos de peligro** opcionales: "Si mueves ahí, te pueden capturar".
- **Deshacer con permiso**: quien se equivoca pide deshacer; el otro acepta con
  un toque. Quita la presión de "ya no hay vuelta atrás".
- **Resumen al final**: qué pasó, sin tono de derrota. "Fin de la partida" en
  lugar de "Perdiste". Botón grande de "Otra ronda".

### Mini-lecciones de ajedrez (fase 3)

Antes de la partida completa, partidas reducidas que ambos pueden jugar:

1. Solo peones (gana quien corona primero).
2. Peones + torres.
3. Peones + torres + alfiles.
4. Tablero completo sin enroque ni al paso.
5. Ajedrez completo.

---

## 6. Experiencia móvil (iPhone 15 / iPad)

- **PWA**: `manifest.json`, iconos, `apple-touch-icon`, pantalla de "Agrégala a
  tu pantalla de inicio" con instrucciones para Safari (Compartir → Agregar a
  pantalla de inicio).
- **Tablero**: tamaño `min(100vw, 100dvh - panel)` con `safe-area-inset`.
  Casillas de al menos 44x44 pt. Piezas con forma distinta además del color.
- **Interacción**: tocar pieza, tocar destino. Nada de arrastrar como método
  principal (falla con scroll y gestos de iOS). `touch-action: manipulation` para
  evitar el zoom por doble toque. `user-select: none` en el tablero.
- **Orientación**: en vertical el tablero arriba y el panel abajo; en iPad
  horizontal el tablero a la izquierda y el panel a la derecha.
- **Reconexión**: en `visibilitychange` y `online`, recargar partida y
  resuscribirse. iOS corta el WebSocket al bloquear el teléfono.
- **Sin cronómetro**. El juego es por turnos y puede esperar.
- **Notificaciones push** ("Es tu turno"): en iOS solo funcionan con la PWA
  instalada (iOS 16.4+) y requieren Web Push con VAPID. Se deja para fase 3.
  Mientras, un banner dentro de la app y el lobby muestran las partidas
  pendientes.
- **Vibración**: `navigator.vibrate` no funciona en iOS. No depender de ella.

---

## 7. Pantallas

1. **Login**: correo y contraseña. Recordar sesión.
2. **Lobby**: partidas activas (con "tu turno" / "su turno"), botón "Nueva
   partida" que abre selector de juego, historial de partidas terminadas,
   indicador de si el otro está en línea.
3. **Partida**: tablero, barra de turno, botones (Reglas, Pista, Deshacer,
   Rendirse), reacciones rápidas, estado de conexión.
4. **Tutorial**: mismo tablero en modo guiado.
5. **Perfil**: nombre, avatar, modo guía, tema de tablero.

Todo el texto en español (es-MX).

---

## 8. Fases de desarrollo

### Fase 0: cimientos
- Crear proyecto Next.js + Tailwind + Supabase client.
- Esquema SQL, RLS, RPC `make_move`, Realtime activado.
- Auth con dos cuentas, sesión persistente.
- Lobby con creación de partida y suscripción en tiempo real.
- PWA básica. Deploy a Vercel. Probar en iPhone.

### Fase 1: primeros juegos
- Interfaz `GameEngine`, motor de Gato y de Damas con tests.
- Tablero táctil genérico, casillas legales resaltadas, explicación de
  movimiento inválido.
- Panel de reglas. Reconexión robusta.

### Fase 2: ayuda y más juegos
- Tutorial interactivo (Damas primero).
- Pistas con minimax ligero. Deshacer con permiso.
- Conecta 4 y Reversi.
- Reacciones con emoji por Broadcast.

### Fase 3: ajedrez y pulido
- Ajedrez con `chess.js` + mini-lecciones.
- Repetición de partidas desde `moves`.
- Notificaciones push (PWA instalada).
- Temas de tablero, sonidos suaves opcionales.

---

## 9. Cosas que debes saber antes de empezar

1. **Supabase gratis pausa el proyecto** tras 7 días sin actividad. Si dejan de
   jugar una semana, hay que reactivarlo desde el panel (tarda ~1 min). Se puede
   evitar con un cron de Vercel que haga una consulta diaria, o con el plan Pro.
2. **Vercel Hobby** es gratis para uso personal no comercial. Suficiente.
3. **Variables de entorno en Vercel**: `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La clave `service_role` nunca va al cliente.
4. **La PWA en iOS es una app separada de Safari**: sesión y almacenamiento
   propios. Se inicia sesión una vez ahí.
5. **Safari en iOS mata el WebSocket** al bloquear la pantalla. Por eso la base
   de datos es la fuente de verdad y siempre se recarga al volver.
6. **Validación de reglas en cliente** es suficiente porque solo son dos personas
   de confianza. Si algún día se abre a más gente, el motor se mueve a una Edge
   Function sin cambiar la interfaz.
7. **Probar en el dispositivo real** desde el primer día con las preview URLs de
   Vercel. El simulador no reproduce bien los gestos de Safari.
8. **Los motores de juego llevan tests exhaustivos**. Un bug de reglas en damas
   (por ejemplo, una captura múltiple mal calculada) es lo que más confunde a
   quien está aprendiendo.
9. **Mantener el tono amable en todos los textos**: sin "perdiste", sin
   cronómetros, sin rankings. Es un espacio para jugar juntos, no para competir.
10. **Dominio propio es opcional**. `algo.vercel.app` funciona perfecto para dos
    personas.

---

## 10. Preguntas abiertas

- Variante de damas: propongo la inglesa/americana por ser la más sencilla.
  Si prefieres damas españolas (la dama "vuela") se cambia el motor, no la interfaz.
- Nombres para mostrar de cada jugador y si quieren avatares.
- Si quieren un pequeño chat de texto o solo reacciones con emoji.
