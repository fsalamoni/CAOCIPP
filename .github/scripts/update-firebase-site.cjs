// /workspace/CAOCIPP-PARCERIAS/.github/scripts/update-firebase-site.js
// Lê CREATED_SITE do env e atualiza firebase.json para usar como site ID
// no lugar de "sigo" (que está reservado por outro projeto Firebase).

const fs = require('fs');
const path = require('path');

const created = process.env.CREATED_SITE;
if (!created) {
  console.error('CREATED_SITE env var não definida');
  process.exit(1);
}

const p = path.join(process.cwd(), 'firebase.json');
const raw = fs.readFileSync(p, 'utf-8');
const cfg = JSON.parse(raw);

if (Array.isArray(cfg.hosting)) {
  for (const h of cfg.hosting) {
    if (h.site === 'sigo') {
      h.site = created;
      console.log(`  -> atualizado 'sigo' -> '${created}'`);
    }
    // Também atualiza o destination do redirect do site legacy
    if (Array.isArray(h.redirects)) {
      for (const r of h.redirects) {
        if (r.destination === 'https://sigo.web.app') {
          r.destination = `https://${created}.web.app`;
          console.log(`  -> redirect destination atualizado para 'https://${created}.web.app'`);
        }
      }
    }
  }
}

fs.writeFileSync(p, JSON.stringify(cfg, null, 4) + '\n');
console.log('firebase.json atualizado com site ID:', created);
