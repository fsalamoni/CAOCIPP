import * as admin from 'firebase-admin';
import { applicationDefault } from 'firebase-admin/app';

/** Projeto do Google Cloud em que as Functions rodam. */
export const projeto = (): string => process.env.GCLOUD_PROJECT || admin.app().options.projectId || '';

/** No emulador não há APIs do Google Cloud de verdade. */
export const noEmulador = (): boolean => process.env.FUNCTIONS_EMULATOR === 'true';

/** Banco do SIGO na API de administração do Firestore. */
export const bancoApi = (): string => `https://firestore.googleapis.com/v1/projects/${projeto()}/databases/(default)`;

/**
 * Chamada às APIs REST do Google Cloud com a conta de serviço das Functions.
 * Lança Error com o status e o começo da resposta quando não dá certo.
 */
export async function googleApi(url: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<any> {
    const { access_token } = await applicationDefault().getAccessToken();
    const metodo = opcoes.metodo || (opcoes.corpo ? 'POST' : 'GET');
    const r = await fetch(url, {
        method: metodo,
        headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
        ...(opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
        signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
        const e = new Error(`${r.status} ${(await r.text()).slice(0, 300)}`) as Error & { status?: number };
        e.status = r.status;
        throw e;
    }
    return r.json();
}
