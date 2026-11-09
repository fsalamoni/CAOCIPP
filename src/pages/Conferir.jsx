import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileSearch, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { secConferir, sha256Arquivo } from '@/services/secretariaService';
import { dataHora } from '@/components/secretaria/comum';

// Conferência pública: qualquer pessoa com o código impresso nas folhas (ou o
// QR) confirma que o documento foi juntado aos autos, quando, por quem e com
// quais assinaturas, e pode comparar o hash de um arquivo que tenha em mãos.
export default function Conferir() {
    const [params, setParams] = useSearchParams();
    const [codigo, setCodigo] = useState(params.get('c') || '');
    const [estado, setEstado] = useState({ carregando: false, erro: '', dados: null });
    const [arquivo, setArquivo] = useState(null);

    const consultar = async (valor = codigo) => {
        if (!valor.trim()) return;
        setEstado({ carregando: true, erro: '', dados: null });
        setArquivo(null);
        try {
            const dados = await secConferir(valor.trim());
            setEstado({ carregando: false, erro: '', dados });
            setCodigo(dados.codigo);
            setParams({ c: dados.codigo }, { replace: true });
        } catch (e) {
            setEstado({ carregando: false, erro: e?.message || 'Não foi possível conferir', dados: null });
        }
    };

    useEffect(() => {
        if (params.get('c')) consultar(params.get('c'));
    }, []);

    const compararArquivo = async (file) => {
        if (!file) return;
        const hash = await sha256Arquivo(file);
        const d = estado.dados;
        setArquivo({ nome: file.name, hash, confere: hash === d.sha256 || hash === d.pdf_sha256 });
    };

    const d = estado.dados;
    const folhas = d?.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial} a ${d.folha_final}` : `fl. ${d.folha_inicial}`) : null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" /> Conferência de documento
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Digite o código impresso no alto das folhas do documento (ou leia o QR) para confirmar que ele foi juntado a um processo da Secretaria Processual.
                </p>
                <form className="flex flex-col sm:flex-row gap-2 sm:items-end" onSubmit={(e) => { e.preventDefault(); consultar(); }}>
                    <div className="flex-1">
                        <Label htmlFor="codigo">Código de conferência</Label>
                        <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX"
                            autoComplete="off" spellCheck={false} className="mt-1 font-mono uppercase tracking-wider" />
                    </div>
                    <Button type="submit" className="gap-2" disabled={estado.carregando || !codigo.trim()}>
                        {estado.carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Conferir
                    </Button>
                </form>

                {estado.erro && (
                    <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-3 text-sm">
                        <XCircle className="w-5 h-5 shrink-0" /> {estado.erro}
                    </p>
                )}

                {d && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-base">
                                <CheckCircle2 className="w-5 h-5" /> Documento autêntico, juntado aos autos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <dl className="grid sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-2">
                                <dt className="text-slate-500">Órgão</dt><dd>{d.orgao || '—'}</dd>
                                <dt className="text-slate-500">Processo</dt><dd className="font-mono">{d.numero}</dd>
                                <dt className="text-slate-500">Documento</dt><dd>nº {d.ordem} · {d.titulo} <span className="text-slate-500">({d.tipo}{d.peticao ? ', petição de parte' : ''})</span></dd>
                                {folhas && <><dt className="text-slate-500">Folhas</dt><dd>{folhas}</dd></>}
                                <dt className="text-slate-500">Juntado em</dt><dd>{dataHora(d.juntado_em)}{d.juntado_por ? ` por ${d.juntado_por}` : ''}</dd>
                                {d.nome_arquivo && <><dt className="text-slate-500">Arquivo original</dt><dd className="break-all">{d.nome_arquivo}</dd></>}
                            </dl>
                            <div>
                                <p className="font-medium mb-1">Assinaturas</p>
                                {d.assinaturas.length === 0
                                    ? <p className="text-slate-500">Documento sem assinatura eletrônica (arquivo juntado).</p>
                                    : <ul className="space-y-1">{d.assinaturas.map((a, i) => (
                                        <li key={i}>{a.nome} · {dataHora(a.em)} · assinatura eletrônica {a.nivel === 'simples' ? 'simples (Lei 14.063/2020, art. 4º, I)' : a.nivel}</li>
                                    ))}</ul>}
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">Integridade (SHA-256)</p>
                                {d.sha256 && <p className="font-mono text-xs break-all text-slate-600 dark:text-slate-300">Conteúdo: {d.sha256}</p>}
                                {d.pdf_sha256 && <p className="font-mono text-xs break-all text-slate-600 dark:text-slate-300">PDF da juntada: {d.pdf_sha256}</p>}
                            </div>
                            {d.origem === 'upload' && (
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                    <Label htmlFor="arquivo">Tem o arquivo original? Compare o hash sem enviá-lo a ninguém</Label>
                                    <Input id="arquivo" type="file" onChange={(e) => compararArquivo(e.target.files?.[0])} />
                                    {arquivo && (
                                        <p role="status" className={arquivo.confere ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                                            {arquivo.confere ? 'O arquivo é idêntico ao juntado.' : 'O arquivo é diferente do juntado (ou foi alterado).'}
                                        </p>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-slate-500">
                                O PDF baixado dos autos traz carimbos de folha e de conferência, por isso seu hash difere do original; o código acima é que confirma a autenticidade.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
