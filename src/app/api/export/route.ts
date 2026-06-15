export const dynamic = "force-static";
export async function GET() {
  return new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } });
}
