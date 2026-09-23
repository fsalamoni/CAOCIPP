import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Sparkles, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    PANORAMA_ROLES,
    PANORAMA_COLUMN_TYPES,
    roleMeta,
    columnTypeMeta,
} from '@/constants/panorama';
import { formatNumber } from '@/lib/panoramaEngine';

const NENHUM = '__nenhum__';

/**
 * Tela de mapeamento — o coração da configuração do Panorama.
 *
 * Aqui o usuário vê o que a plataforma entendeu de cada coluna da planilha e
 * confirma ou corrige. É o único momento em que alguém precisa entender o
 * conceito de "papel", e por isso a tela explica o que cada papel destrava, em
 * vez de só listar nomes técnicos.
 *
 * O que a plataforma propõe vem de duas evidências combinadas — o NOME da
 * coluna e o CONTEÚDO dela. O motivo da proposta aparece na própria linha,
 * para que o usuário possa discordar com conhecimento de causa.
 */
export default function PanoramaMapeamento({ columns, onChange, compacto = false }) {
    const setColuna = (key, patch) => {
        onChange((columns || []).map((c) => (c.key === key ? { ...c, ...patch } : c)));
    };

    /**
     * Trocar o papel de uma coluna tira o papel de quem o tinha: cada papel
     * pertence a uma coluna só. Fazer isso aqui, e não só no servidor, evita
     * que a tela mostre dois "identificadores" e o usuário descubra o conflito
     * apenas ao salvar.
     */
    /**
     * Trocar o TIPO pode deixar o papel órfão — "valor monetário" numa coluna
     * que passou a ser texto não soma nada, e o órgão veria zero em toda a
     * leitura financeira sem nenhum aviso. O servidor descarta o papel
     * incompatível de qualquer modo; limpar aqui faz o usuário ver isso na
     * hora, na mesma tela em que causou.
     */
    const setTipo = (key, type) => {
        onChange((columns || []).map((c) => {
            if (c.key !== key) return c;
            const papelCabe = !c.role
                || PANORAMA_ROLES.find((r) => r.key === c.role)?.tipos.includes(type);
            return { ...c, type, role: papelCabe ? c.role : null };
        }));
    };

    const setPapel = (key, role) => {
        const alvo = role === NENHUM ? null : role;
        onChange((columns || []).map((c) => {
            if (c.key === key) return { ...c, role: alvo };
            if (alvo && c.role === alvo) return { ...c, role: null };
            return c;
        }));
    };

    const papeisUsados = useMemo(() => {
        const mapa = {};
        for (const c of columns || []) if (c.role) mapa[c.role] = c;
        return mapa;
    }, [columns]);

    const faltando = PANORAMA_ROLES.filter((r) => !papeisUsados[r.key]);
    const semIdentificador = !papeisUsados.identificador;

    return (
        <div className="space-y-4">
            {!compacto && (
                <Alert>
                    <Sparkles className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        A plataforma leu a planilha e propôs um <strong>papel</strong> para cada coluna,
                        olhando o nome dela e o conteúdo. Papel é o que a coluna <em>significa</em> para a
                        análise — qual é a data que ordena o tempo, qual é o território, qual é o
                        resultado. Confira as propostas abaixo e corrija o que estiver errado: é esta
                        escolha que faz o painel e os relatórios saberem o que somar.
                    </AlertDescription>
                </Alert>
            )}

            {semIdentificador && (
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        <strong>Nenhuma coluna está marcada como identificador.</strong> Sem ele, a
                        plataforma não reconhece um registro que já existe: cada importação acrescenta
                        tudo de novo e a base dobra de tamanho a cada envio. Marque a coluna do número do
                        processo, do procedimento ou do protocolo.
                    </AlertDescription>
                </Alert>
            )}

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[200px]">Coluna da planilha</TableHead>
                            <TableHead className="w-[150px]">Tipo</TableHead>
                            <TableHead className="w-[230px]">Papel na análise</TableHead>
                            <TableHead className="min-w-[240px]">O que a plataforma viu</TableHead>
                            <TableHead className="w-20 text-center">Exibir</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(columns || []).map((col) => {
                            const meta = col.role ? roleMeta(col.role) : null;
                            const tipoMeta = columnTypeMeta(col.type);
                            const preenchidos = (col.cardinalidade ?? 0);
                            const sugeriu = col.papelSugerido && col.papelSugerido === col.role;

                            return (
                                <TableRow key={col.key}>
                                    <TableCell>
                                        <Input
                                            value={col.label}
                                            onChange={(e) => setColuna(col.key, { label: e.target.value })}
                                            className="h-8 text-sm font-medium"
                                        />
                                        {col.origem && col.origem !== col.label && (
                                            <p className="text-[11px] text-slate-400 mt-1 truncate" title={col.origem}>
                                                na planilha: {col.origem}
                                            </p>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <Select
                                            value={col.type}
                                            onValueChange={(type) => setTipo(col.key, type)}
                                        >
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PANORAMA_COLUMN_TYPES.map((t) => (
                                                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                                            {tipoMeta.descricao}
                                        </p>
                                    </TableCell>

                                    <TableCell>
                                        <Select
                                            value={col.role || NENHUM}
                                            onValueChange={(role) => setPapel(col.key, role)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Sem papel" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NENHUM}>
                                                    — só informativa —
                                                </SelectItem>
                                                {PANORAMA_ROLES
                                                    .filter((r) => r.tipos.includes(col.type))
                                                    .map((r) => (
                                                        <SelectItem key={r.key} value={r.key}>
                                                            {r.label}
                                                            {papeisUsados[r.key] && papeisUsados[r.key].key !== col.key
                                                                ? ` (hoje: ${papeisUsados[r.key].label})`
                                                                : ''}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        {meta ? (
                                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 leading-tight">
                                                {meta.destrava}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                                                Aparece na tabela e serve de filtro, mas não entra nos cálculos.
                                            </p>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <Badge variant="outline" className="text-[10px] font-normal">
                                                {formatNumber(preenchidos)} valor(es) distinto(s)
                                            </Badge>
                                            {(col.vazios ?? 0) > 0 && (
                                                <Badge variant="outline" className="text-[10px] font-normal text-amber-600">
                                                    {formatNumber(col.vazios)} vazio(s)
                                                </Badge>
                                            )}
                                            {sugeriu && (
                                                <Badge variant="outline" className="text-[10px] font-normal gap-1 text-emerald-600">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    proposto
                                                </Badge>
                                            )}
                                        </div>
                                        {col.amostra?.length > 0 && (
                                            <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                                                Ex.: {col.amostra.slice(0, 3).join(' · ')}
                                            </p>
                                        )}
                                        {col.motivoSugestao && !col.role && (
                                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5 italic">
                                                {col.motivoSugestao}
                                            </p>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-center">
                                        <Switch
                                            checked={col.visivel !== false}
                                            onCheckedChange={(visivel) => setColuna(col.key, { visivel })}
                                            aria-label={`Exibir ${col.label} na tabela`}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {faltando.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Info className="w-4 h-4 text-slate-400" />
                            Papéis ainda sem coluna ({faltando.length})
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Nenhum papel é obrigatório. Cada um que ficar sem coluna apenas deixa de
                            destravar a análise correspondente — o resto do módulo funciona normalmente.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1.5">
                            {faltando.map((r) => (
                                <li key={r.key} className="text-xs text-slate-600 dark:text-slate-300">
                                    <strong>{r.label}</strong>
                                    <span className="text-slate-400"> — {r.exemplo}. </span>
                                    {r.consequenciaSemEle}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
