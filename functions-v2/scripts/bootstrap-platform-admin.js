// Script de bootstrap ÚNICO do primeiro super-admin da plataforma.
// Uso: node scripts/bootstrap-platform-admin.js <email>
// Requer ADC (gcloud auth application-default login) com acesso ao projeto.
// Idempotente: pode rodar mais de uma vez sem efeito colateral.

const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'protagonista-rpg';
const email = (process.argv[2] || '').trim().toLowerCase();

if (!email) {
  console.error('ERRO: informe o e-mail. Ex: node scripts/bootstrap-platform-admin.js fulano@dominio.com');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const uid = user.uid;

    // 1. Custom claim (preserva claims existentes)
    const existing = user.customClaims || {};
    await admin.auth().setCustomUserClaims(uid, { ...existing, platformAdmin: true });

    // 2. Registro na allowlist (lido pelo frontend e backend)
    await admin.firestore().collection('platformAdmins').doc(uid).set(
      {
        active: true,
        email,
        name: user.displayName || email,
        granted_at: admin.firestore.FieldValue.serverTimestamp(),
        granted_by: 'bootstrap-script',
        source: 'bootstrap',
      },
      { merge: true }
    );

    console.log(`OK: ${email} (uid=${uid}) agora é super-admin (claim + allowlist) no projeto ${PROJECT_ID}.`);
    console.log('Faça logout/login no app para o token atualizar.');
    process.exit(0);
  } catch (err) {
    console.error('FALHA no bootstrap:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
