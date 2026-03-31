/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Sets up a global proxy dispatcher so that Node.js native fetch()
 * respects HTTPS_PROXY / HTTP_PROXY environment variables.
 */
export async function register() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  if (proxyUrl && process.env.NEXT_RUNTIME === "nodejs") {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[instrumentation] Global fetch proxy → ${proxyUrl}`);
  }
}
