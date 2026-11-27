import React, { useContext } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QUEM, comPermissao, reservas } from '@/lib/permissoesFase';
import { RegistroContexto } from './SeletorRegistro';

const campo = 'h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const dica = 'mt-1 block text-xs text-slate-600 dark:text-slate-400';
const MAX_ATRIBUICAO = 80; // igual ao servidor

/** A atribuição de quem pode, com as que já existem nas lotações do órgão como sugestão. */
export function CampoAtribuicao({ id, value, onChange }) {
    const { atribuicoes = [] } = useContext(RegistroContexto);
    return (
        <div className="mt-2">
            <Label htmlFor={id} className="text-xs">Qual atribuição</Label>
            <Input id={id} className="h-9" list={`${id}-lista`} value={value || ''} maxLength={MAX_ATRIBUICAO} placeholder="Ex.: Promotor" aria-invalid={!String(value || '').trim()}
                onChange={(e) => onChange(e.target.value)} />
            <datalist id={`${id}-lista`}>{atribuicoes.map((a) => <option key={a} value={a} />)}</datalist>
            <span className={dica}>Como está na lotação da pessoa, em Unidades (não conta acento nem maiúscula). Vale a atribuição que ela tem na unidade que estiver com o processo.</span>
        </div>
    );
}

function Escolha({ id, rotulo, valor, opcoes, onChange, children }) {
    return (
        <div>
            <Label htmlFor={id} className="text-xs">{rotulo}</Label>
            <select id={id} value={valor || ''} onChange={(e) => onChange(e.target.value)} className={campo}>
                {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {children}
        </div>
    );
}

/**
 * Quem pode, nesta fase: concluir, dispensar o que ela exige, seguir por
 * caminho fora do previsto e mudar a situação do processo. Sem escolha, vale
 * o de sempre (quem tem o processo, com motivo quando o ato pede).
 * `aplicarATodas(permissoes)`: copia para as outras fases do rito.
 */
export default function PermissoesDaFase({ f, mudar, aplicarATodas }) {
    const pm = f.permissoes || {};
    const set = (parte) => mudar({ permissoes: comPermissao(pm, parte) });
    const id = `pm-${f.id}`;
    return (
        <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
                <Escolha id={`${id}-c`} rotulo="Quem conclui a fase" valor={pm.concluir} opcoes={QUEM}
                    onChange={(v) => set({ concluir: v, concluir_atribuicao: v === 'atribuicao' ? pm.concluir_atribuicao || '' : undefined })}>
                    {pm.concluir === 'atribuicao' && <CampoAtribuicao id={`${id}-ca`} value={pm.concluir_atribuicao} onChange={(v) => set({ concluir_atribuicao: v })} />}
                    <span className={dica}>
                        {f.final ? 'Fase final não segue para outra: o que encerra o processo é arquivar (ao lado).' : 'Concluir é levar o processo a outra fase. Ir para uma fase de espera não conclui e continua com quem tem o processo.'}
                        {f.avanco === 'auto' && pm.concluir && !f.final ? ' Com "Seguir sozinha", a fase só segue sozinha quando quem cumpre o último item pode concluí-la; senão fica o botão para quem pode.' : ''}
                    </span>
                </Escolha>
                <Escolha id={`${id}-d`} rotulo="Quem dispensa o que a fase exige" valor={pm.dispensar} opcoes={reservas('Quem conclui a fase, com motivo')} onChange={(v) => set({ dispensar: v })}>
                    <span className={dica}>Vale para ação obrigatória, documento obrigatório e campo exigido que ficaram em aberto. Os demais precisam cumprir tudo para a fase seguir.</span>
                </Escolha>
                <Escolha id={`${id}-v`} rotulo="Quem segue por caminho fora do previsto" valor={pm.desviar} opcoes={reservas('Quem conclui a fase, com motivo')} onChange={(v) => set({ desviar: v })}>
                    <span className={dica}>Fase que não é saída desta, ou saída sem a resposta que a regra dela pede.</span>
                </Escolha>
                <Escolha id={`${id}-s`} rotulo="Quem arquiva, sobresta ou reativa" valor={pm.situacao} opcoes={reservas('Quem tem o processo, com motivo')} onChange={(v) => set({ situacao: v })}>
                    <span className={dica}>Enquanto o processo estiver nesta fase. O arquivamento que o rito faz sozinho ao entrar numa fase não depende disto.</span>
                </Escolha>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                A administração do Processo Eletrônico sempre pode. Quem não pode vê na tela do processo a quem o ato está reservado.
                {' '}Quem aprova a minuta (junta aos autos ou devolve para correção) se escolhe em "Minuta: elaboração e aprovação".
            </p>
            {aplicarATodas && (
                <Button variant="outline" size="sm" onClick={() => { aplicarATodas(f.permissoes); toast.success('Aplicado a todas as fases do rito'); }}>Aplicar a todas as fases</Button>
            )}
        </div>
    );
}
