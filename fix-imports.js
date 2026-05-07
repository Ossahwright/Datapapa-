import fs from 'fs';
import path from 'path';

const dirs = ['api', 'lib'];

for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace .js imports with extensionless or clean relative imports
    content = content.replace(/\.\.\/lib\/server-utils\.js/g, '../lib/server-utils');
    content = content.replace(/\.\/server-utils\.js/g, './server-utils');
    content = content.replace(/\.\/supabase\.js/g, './supabase');
    content = content.replace(/\.\.\/lib\/datahub-client\.js/g, '../lib/datahub-client');

    fs.writeFileSync(filePath, content);
  }
}

console.log("Imports updated successfully!");
