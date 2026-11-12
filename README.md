# WebSocket Traffic City

A small city with traffic that every connected browser sees and can act on at the same time. The server runs the simulation and sends the full state over WebSocket; browsers draw it and send their actions back.

- A fixed 3x3 grid of two-way streets with a traffic light at every crossing.
- Cars drive straight, stop at red and queue behind each other.
- Anyone can click a crossing to bring its light change forward, or adjust the traffic volume and the green time for the whole city.

## How it was built

This project was developed with the [Compound Engineering plugin](https://github.com/everyinc/compound-engineering-plugin), which works with several AI coding tools.

It follows the workshop [Intro to Compound Engineering](https://9punto5.cl/program/intro-to-compound-engineering) at the 9punto5 conference, presented by the plugin's author.

## Requirements

- Node.js 22 or newer
- pnpm 10

## Getting started

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173 in two or more browser windows.

Run `pnpm test` for the tests and `pnpm typecheck` for the type check.
