/**
 * Cópia em objetos comuns do que vai a uma Cloud Function. O editor
 * (ProseMirror/TipTap) monta os `attrs` sem protótipo (`Object.create(null)`),
 * e o SDK do Firebase não sabe enviá-los: falha com "hasOwnProperty is not a
 * function" e nada é salvo. Date, File e Blob seguem como estão.
 */
export function paraEnvio(v) {
    if (Array.isArray(v)) return v.map(paraEnvio);
    if (v && typeof v === 'object') {
        const proto = Object.getPrototypeOf(v);
        if (proto === null || proto === Object.prototype) {
            const out = {};
            for (const k of Object.keys(v)) out[k] = paraEnvio(v[k]);
            return out;
        }
    }
    return v;
}
