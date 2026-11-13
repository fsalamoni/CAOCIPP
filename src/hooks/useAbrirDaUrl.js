import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/config/firebase';

/** Id de documento aceito em `?abrir` (um só segmento do caminho). */
const idValido = (id) => id.length <= 1500 && !id.includes('/') && id !== '.' && id !== '..';

/**
 * Abre o registro pedido em `?abrir=<id>` (link do processo eletrônico, da busca).
 * Espera a aba estar com o órgão do endereço (`?id`). Procura na lista já carregada;
 * se não estiver nela (paginação), lê o documento, conferindo o órgão (as regras do
 * Firestore continuam decidindo quem lê). Tira o parâmetro da URL antes de abrir.
 */
export function useAbrirDaUrl({ lista, colecao, orgId, carregando, abrir }) {
    const [params, setParams] = useSearchParams();
    const id = params.get('abrir');
    const orgDaUrl = params.get('id');
    const feito = useRef(null);
    const abrirRef = useRef(abrir);
    abrirRef.current = abrir;
    const montado = useRef(true);
    useEffect(() => () => { montado.current = false; }, []);

    useEffect(() => {
        // Sem pedido: o mesmo registro pode ser pedido de novo depois.
        if (!id) { feito.current = null; return; }
        // Troca de órgão em andamento (busca em outro órgão): espera a aba ficar com o órgão do endereço.
        if (!orgId || orgId !== orgDaUrl || feito.current === id) return;
        const achado = (lista || []).find((r) => r.id === id);
        if (!achado && carregando) return;
        feito.current = id;
        setParams((prev) => {
            const n = new URLSearchParams(prev);
            n.delete('abrir');
            return n;
        }, { replace: true });
        if (achado) { abrirRef.current(achado); return; }
        if (!idValido(id)) { toast.error('Endereço de registro inválido.'); return; }
        getDoc(doc(db, colecao, id))
            .then((s) => {
                if (!montado.current) return;
                const d = s.exists() ? s.data() : null;
                if (d && d.organization_id === orgId) abrirRef.current({ id: s.id, ...d });
                else toast.error('Registro não encontrado neste órgão.');
            })
            .catch((e) => {
                if (!montado.current) return;
                toast.error(e?.code === 'permission-denied' ? 'Você não tem acesso a esse registro.' : 'Não foi possível abrir o registro. Tente de novo.');
            });
    }, [id, orgId, orgDaUrl, carregando, lista, colecao, setParams]);
}
