import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// === KEYWORD MAPPING ===
// Copied from MatterCategorySelect.jsx / planned script logic
const KEYWORD_MAP = [
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
        keywords: ['improbidade', 'enriquecimento ilícito', 'dano ao erário', 'dano ao erario', 'prejuízo ao erário', 'violação aos princípios', 'lei 8429']
    },
    {
        category: 'Proteção da moralidade e do patrimônio público',
        subcategory: 'Agentes Públicos',
        keywords: ['servidor público', 'concurso público', 'nomeação', 'desvio de função', 'acumulação de cargos', 'processo administrativo disciplinar', 'pad', 'estágio probatório']
    },
    {
        category: 'Proteção da moralidade e do patrimônio público',
        subcategory: 'Emendas Parlamentares',
        keywords: ['emenda parlamentar', 'emendas']
    },
    {
        category: 'Proteção da moralidade e do patrimônio público',
        subcategory: 'Bens Públicos',
        keywords: ['bens públicos', 'imóvel público', 'desafetação', 'doação de bens']
    },

    // === Cível ===
    {
        category: 'Cível',
        subcategory: 'Família',
        keywords: ['família', 'familia', 'divórcio', 'divorcio', 'guarda', 'alimentos', 'paternidade', 'união estável', 'investigação de paternidade']
    },
    {
        category: 'Cível',
        subcategory: 'Sucessões',
        keywords: ['sucessões', 'sucessoes', 'inventário', 'inventario', 'herança', 'testamento', 'alvará judicial']
    },
    {
        category: 'Cível',
        subcategory: 'Registros Públicos',
        keywords: ['registro de imóveis', 'registro civil', 'retificação de registro', 'usucapião', 'loteamento', 'averbação']
    },
    {
        category: 'Cível',
        subcategory: 'Contratos',
        keywords: ['contrato', 'rescisão contratual', 'inadimplemento']
    },

    // === Processual ===
    {
        category: 'Processual',
        subcategory: 'Processo Civil',
        keywords: ['conflito de competência', 'declínio de atribuição', 'competência']
    },
];

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function runBackfill(dryRun = true) {
    console.group(`🚀 Starting Matter Backfill (${dryRun ? 'DRY RUN' : 'LIVE'})`);
    console.log('Fetching processes...');

    try {
        const querySnapshot = await getDocs(collection(db, 'processes'));
        const processes = querySnapshot.docs;
        console.log(`Found ${processes.length} processes.`);

        let processedCount = 0;
        let matchCount = 0;
        let updatedCount = 0;
        const updates = [];

        console.table(['ID', 'Source', 'Keyword', 'Category', 'Subcategory']);

        for (const processDoc of processes) {
            const data = processDoc.data();
            const processId = processDoc.id;
            processedCount++;

            // Skip if already has category
            if (data.matter_category && data.matter_category.trim() !== '') {
                continue;
            }

            const networkFolder = normalizeText(data.network_folder || '');
            const matterObject = normalizeText(data.matter_object || '');

            let foundMatch = null;
            let matchSource = '';
            let matchKeyword = '';

            // Apply logic
            for (const rule of KEYWORD_MAP) {
                for (const keyword of rule.keywords) {
                    const normalizedKeyword = normalizeText(keyword);

                    if (networkFolder.includes(normalizedKeyword)) {
                        foundMatch = rule;
                        matchSource = 'FOLDER';
                        matchKeyword = keyword;
                        break;
                    }

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
                console.log(`%c[MATCH] ${data.process_number || processId}`, 'color: green',
                    `\n   Source: ${matchSource} ("${matchKeyword}")`,
                    `\n   => ${foundMatch.category} / ${foundMatch.subcategory}`
                );

                if (!dryRun) {
                    const updatePromise = updateDoc(doc(db, 'processes', processId), {
                        matter_category: foundMatch.category,
                        matter_subcategory: foundMatch.subcategory,
                        updated_at: serverTimestamp(),
                        logs: arrayUnion({
                            action: 'System Auto-Classification',
                            timestamp: new Date().toISOString(),
                            details: `Classified based on ${matchSource} keyword: '${matchKeyword}'`,
                            user_name: 'Backfill System'
                        })
                    }).then(() => {
                        console.log(`✅ Updated ${processId}`);
                    }).catch(err => {
                        console.error(`❌ Failed to update ${processId}`, err);
                    });

                    updates.push(updatePromise);
                }
            }
        }

        if (!dryRun && updates.length > 0) {
            console.log(`Applying ${updates.length} updates...`);
            await Promise.all(updates);
            updatedCount = updates.length;
        }

        console.log(`\n--- SUMMARY ---`);
        console.log(`Total: ${processedCount}`);
        console.log(`Matches: ${matchCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Mode: ${dryRun ? 'DRY RUN (No changes made)' : 'LIVE (Changes applied)'}`);
        console.groupEnd();

        if (dryRun) {
            alert(`Simulação concluída! Encontrei ${matchCount} processos para classificar. Abra o console (F12) para ver os detalhes.`);
        } else {
            alert(`Sucesso! ${updatedCount} processos foram classificados e atualizados.`);
        }

    } catch (error) {
        console.error("Backfill failed:", error);
        alert("Erro ao rodar backfill. Veja o console.");
    }
}
