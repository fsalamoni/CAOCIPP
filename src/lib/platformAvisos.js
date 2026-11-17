// Aviso para todos e modo manutenção (platformConfig/avisos). Funções puras,
// testadas em platformAvisos.test.js.

/** O aviso aparece agora? Ativo, dentro do período e não dispensado por esta pessoa. */
export function avisoVisivel(aviso, agora = new Date(), dispensados = []) {
    if (!aviso?.ativo || !aviso.titulo) return false;
    const t = agora.getTime();
    if (aviso.inicio && new Date(aviso.inicio).getTime() > t) return false;
    if (aviso.fim && new Date(aviso.fim).getTime() <= t) return false;
    if (aviso.dispensavel !== false && aviso.id && dispensados.includes(aviso.id)) return false;
    return true;
}

/** Situação do aviso para o painel: no ar, agendado, encerrado ou expirado. */
export function situacaoAviso(aviso, agora = new Date()) {
    if (!aviso?.titulo) return 'nenhum';
    if (!aviso.ativo) return 'encerrado';
    if (aviso.fim && new Date(aviso.fim) <= agora) return 'expirado';
    if (aviso.inicio && new Date(aviso.inicio) > agora) return 'agendado';
    return 'no_ar';
}

/** A tela de manutenção vale para esta pessoa? Super-admin sempre passa. */
export function bloqueadoPorManutencao(manutencao, isPlatformAdmin) {
    return manutencao?.ativa === true && !isPlatformAdmin;
}

export const TONS_AVISO = {
    info: { rotulo: 'Informação' },
    alerta: { rotulo: 'Atenção' },
    critico: { rotulo: 'Urgente' },
};
