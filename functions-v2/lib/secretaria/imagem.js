"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otimizarImagem = otimizarImagem;
// sharp (nativo, pesado) carregado só quando há imagem a tratar (partida a frio das functions).
const sharp = (...a) => require('sharp')(...a);
/** A4 a 300 dpi: mais do que isso não aparece nem na tela nem na impressão da folha. */
const LARGURA_MAX = 2480;
const ALTURA_MAX = 3508;
/**
 * Imagem para as folhas dos autos, sem perda perceptível: na orientação da
 * câmera (EXIF), no máximo 300 dpi numa A4, em JPEG de qualidade 85 (sem
 * subamostragem de cor, que borra texto) ou, para PNG, em PNG sem perda,
 * o que ficar menor. Devolve null se o original já for menor e estiver na
 * orientação certa. Usada só na versão de leitura: o original não muda.
 */
async function otimizarImagem(buf, mime) {
    const meta = await sharp(buf, { failOn: 'none' }).metadata();
    const girada = !!meta.orientation && meta.orientation > 1;
    const base = () => sharp(buf, { failOn: 'none' }).rotate()
        .resize({ width: LARGURA_MAX, height: ALTURA_MAX, fit: 'inside', withoutEnlargement: true });
    const jpg = await base().flatten({ background: '#ffffff' })
        .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
    let melhor = { buf: jpg, mime: 'image/jpeg' };
    if (mime === 'image/png') {
        // Captura de tela e documento digitalizado em PNG costumam ficar menores sem perda nenhuma.
        const png = await base().png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toBuffer();
        if (png.length <= jpg.length * 1.15)
            melhor = { buf: png, mime: 'image/png' };
    }
    if (!girada && melhor.buf.length >= buf.length)
        return null;
    return melhor;
}
//# sourceMappingURL=imagem.js.map