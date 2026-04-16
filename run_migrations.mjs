import { execSync } from 'child_process';
import fs from 'fs';
const sql = fs.readFileSync('insforge/migrations/002_invitations.sql', 'utf8');

// remove lines starting with --
const cleanSql = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');

// split by ;
const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0);

for (const stmt of statements) {
  try {
    console.log(`Executing: ${stmt.substring(0, 50).replace(/\n/g, ' ')}...`);
    // Escape quotes for bash/powershell
    const escapedStmt = stmt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const out = execSync(`npx @insforge/cli db query "${escapedStmt};"`, { encoding: 'utf8' });
    console.log(`Success.`);
  } catch (err) {
    if (err.output && err.output.join('').includes('already exists')) {
      console.log('Already exists, skipping...');
    } else {
      console.error(`Error on:\n${stmt}`);
      console.error(err.output ? err.output.join('\n') : err.message);
    }
  }
}
console.log('All done.');
