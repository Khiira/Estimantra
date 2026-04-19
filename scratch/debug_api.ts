import { insforge } from './src/lib/insforge';

async function debug() {
  try {
    console.log("Testing join 'organizations'...");
    const { data: d1, error: e1 } = await insforge.database
      .from('organization_members')
      .select('role, organizations(id, name)')
      .limit(1);
    console.log("Result 1:", { data: d1, error: e1 });

    console.log("\nTesting join 'organization'...");
    const { data: d2, error: e2 } = await insforge.database
      .from('organization_members')
      .select('role, organization(id, name)')
      .limit(1);
    console.log("Result 2:", { data: d2, error: e2 });

    console.log("\nTesting join with org_id...");
    const { data: d3, error: e3 } = await insforge.database
      .from('organization_members')
      .select('role, org_id(id, name)')
      .limit(1);
    console.log("Result 3:", { data: d3, error: e3 });

  } catch (err) {
    console.error("Critical error:", err);
  }
}

// Note: I can't run this directly easily because it's TypeScript/Vite.
// I'll try to use a CLI tool if available or just guess based on common InsForge patterns.
