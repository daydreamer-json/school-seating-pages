import bun from 'bun';
import { Hono } from 'hono';
import open from 'open';
import path from 'node:path';
import readline from 'node:readline';

async function main() {
  const app = new Hono();

  app.use('/*', async (c, next) => {
    const requestPath = c.req.path;
    const normalizedPath =
      requestPath.replace(/^\/+/, '').replace(/\/+/g, '/') + (requestPath.endsWith('/') ? 'index.html' : '');
    const filePath = path.join('./', normalizedPath);
    if (await bun.file(filePath).exists()) {
      try {
        return new Response(bun.file(filePath));
      } catch (error) {
        console.warn(`Error serving file: ${filePath}`);
      }
    }
    console.warn(`Requested file not found: ${requestPath}`);
    await next();
    return c.notFound();
  });

  const server = bun.serve({
    port: 0, // random
    fetch: app.fetch,
  });

  console.log(`HTTP server running at http://localhost:${server.port}`);
  await open(`http://localhost:${server.port}/src/index.html`);
  console.log('Press any key to close the server ...');
  await pressAnyKeyToContinue(false);
  server.stop();
}

async function pressAnyKeyToContinue(printText: boolean = true): Promise<void> {
  printText ? process.stdout.write('Press any key to continue ...') : null;
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      printText ? process.stdout.write(`\n`) : null;
      resolve(); // Promiseを解決
    });
  });
}

await main();
