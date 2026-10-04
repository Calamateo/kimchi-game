# Kimchi

Juegos de mesa clásicos para jugar en línea entre dos personas, pensado para
iPhone e iPad. El plan completo está en [PLAN.md](./PLAN.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Realtime y Auth
- Vercel para el despliegue

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y llena los valores
npm run dev
```

Pruebas de los motores de juego:

```bash
npm test
```

## Estructura

```
src/
  app/              rutas (login, lobby, partida/[id], manifest PWA)
  components/       UI, lobby, sala de juego y tableros
  lib/games/        motores de juego puros (un folder por juego) + registro
  lib/supabase/     clientes de Supabase (navegador y servidor)
  proxy.ts          protege rutas y refresca la sesión
```

## Agregar un juego

1. Crear `src/lib/games/<juego>/engine.ts` implementando `GameEngine` y sus tests.
2. Crear el tablero en `src/components/games/`.
3. Registrarlo en `src/lib/games/registry.ts` y renderizarlo en `GameRoom.tsx`.
