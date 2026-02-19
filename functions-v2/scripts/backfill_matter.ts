import * as admin from 'firebase-admin';


// Initialize Admin SDK
// Assumes GOOGLE_APPLICATION_CREDENTIALS is set or user is logged in via `gcloud auth application-default login`
// OR running in an environment with default credentials.
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    } catch (e) {
        console.error("Error initializing Firebase Admin. Make sure you are authenticated:", e);
        process.exit(1);
    }
}

const db = admin.firestore();

// === CONFIGURATION ===
const COLLECTION_NAME = 'processes'; // Adjust if different organization logic uses subcollections, but usually root 'processes'
const DRY_RUN = process.argv.includes('--dry-run');

// === KEYWORD MAPPING ===
// Order matters: more specific keywords should come before general ones if needed.
// This map allows regex strings or simple strings.
const KEYWORD_MAP: Array<{
    category: string;
    subcategory: string;
    keywords: string[];
}> = [
        // === Proteção da moralidade e do patrimônio público ===
        {
            category: 'Proteção da moralidade e do patrimônio público',
            subcategory: 'ACP / TAC / FRBL',
            keywords: ['acp', 'ação civil pública', 'civil publica', 'tac', 'ajustamento de conduta', 'frbl', 'fundo de reconstituição', 'inquérito civil']
        },
        {
            category: 'Proteção da moralidade e do patrimônio público',
            subcategory: 'Licitações',
            keywords: ['licitação', 'licitacao', 'pregão', 'pregao', 'concorrência', 'concorrencia', 'contrato administrativo', 'dispensa de licitação', 'inexigibilidade']
        },
        {
            category: 'Proteção da moralidade e do patrimônio público',
            subcategory: 'Improbidade Administrativa',
            keywords: ['improbidade', 'enriquecimento ilícito', 'dano ao erário', 'dano ao erario', 'prejuízo ao erário', 'violação aos princípios']
        },
        {
            category: 'Proteção da moralidade e do patrimônio público',
            subcategory: 'Agentes Públicos',
            keywords: ['servidor público', 'concurso público', 'nomeação', 'desvio de função', 'acumulação de cargos', 'processo administrativo disciplinar', 'pad']
        },
        {
            category: 'Proteção da moralidade e do patrimônio público',
            subcategory: 'Emendas Parlamentares',
            keywords: ['emenda parlamentar', 'emendas']
        },

        // === Cível ===
        {
            category: 'Cível',
            subcategory: 'Família',
            keywords: ['família', 'familia', 'divórcio', 'divorcio', 'guarda', 'alimentos', 'paternidade', 'união estável']
        },
        {
            category: 'Cível',
            subcategory: 'Sucessões',
            keywords: ['sucessões', 'sucessoes', 'inventário', 'inventario', 'herança', 'testamento']
        },
        {
            category: 'Cível',
            subcategory: 'Registros Públicos',
            keywords: ['registro de imóveis', 'registro civil', 'retificação de registro', 'usucapião', 'loteamento']
        },

        // === Processual ===
        {
            category: 'Processual',
            subcategory: 'Processo Civil',
            keywords: ['conflito de competência', 'declínio de atribuição', 'competência']
        },

        // Default fallback logic could enter here if needed
    ];

function normalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents roughly
}

async function run() {
    console.log(`Starting Matter Backfill Script`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (Simulação)' : 'LIVE (Execução Real)'}`);

    const processesRef = db.collection(COLLECTION_NAME);
    const snapshot = await processesRef.get();

    if (snapshot.empty) {
        console.log('No processes found.');
        return;
    }

    let processedCount = 0;
    let matchCount = 0;
    let updatedCount = 0;

    // Header for report
    console.log('\n--- MATCH REPORT ---');
    console.log('ID | Process Number | Match Source | Keyword | New Category | New Subcategory');

    const updates: Promise<any>[] = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        processedCount++;

        // Skip if already categorized (unless we want to overwrite, but user said "fill", implying empty ones)
        if (data.matter_category && data.matter_category.trim() !== '') {
            continue;
        }

        const networkFolder = normalizeText(data.network_folder || '');
        const matterObject = normalizeText(data.matter_object || '');

        let foundMatch = null;
        let matchSource = '';
        let matchKeyword = '';

        // Try to match
        for (const rule of KEYWORD_MAP) {
            for (const keyword of rule.keywords) {
                const normalizedKeyword = normalizeText(keyword);

                // Check Network Folder
                if (networkFolder.includes(normalizedKeyword)) {
                    foundMatch = rule;
                    matchSource = 'FOLDER';
                    matchKeyword = keyword;
                    break;
                }

                // Check Matter Object
                if (matterObject.includes(normalizedKeyword)) {
                    foundMatch = rule;
                    matchSource = 'OBJECT';
                    matchKeyword = keyword;
                    break;
                }
            }
            if (foundMatch) break;
        }

        if (foundMatch) {
            matchCount++;
            console.log(`${doc.id} | ${data.process_number || 'N/A'} | ${matchSource} | "${matchKeyword}" | ${foundMatch.category} | ${foundMatch.subcategory}`);

            if (!DRY_RUN) {
                updates.push(doc.ref.update({
                    matter_category: foundMatch.category,
                    matter_subcategory: foundMatch.subcategory,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    logs: admin.firestore.FieldValue.arrayUnion({
                        action: 'System Auto-Classification',
                        timestamp: new Date().toISOString(),
                        details: `Classified based on ${matchSource} keyword: '${matchKeyword}'`
                    })
                }));
            }
        }
    }

    if (!DRY_RUN && updates.length > 0) {
        console.log(`\nApplying ${updates.length} updates...`);
        await Promise.all(updates);
        updatedCount = updates.length;
    }

    console.log('\n--- SUMMARY ---');
    console.log(`Total Processes Scanned: ${processedCount}`);
    console.log(`Potential Matches Found: ${matchCount}`);
    if (!DRY_RUN) {
        console.log(`Updates Applied: ${updatedCount}`);
    } else {
        console.log(`Updates Applied: 0 (Dry Run)`);
    }
}

run().catch(console.error);
