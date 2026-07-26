// Instrumentation Next.js : exécutée au démarrage du serveur (Node runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureInitialized } = await import('./lib/init');
    ensureInitialized();
  }
}
