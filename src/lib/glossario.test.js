// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GLOSSARIO } from './glossario.js';

const IDS = ['autos', 'autuar', 'certidao_conjunta', 'ciencia_decurso', 'dispensa', 'juntada', 'remessa', 'sobrestar'];

test('glossário: os oito termos, uma ou duas frases, sem travessão, em ordem alfabética', () => {
    assert.deepEqual(Object.keys(GLOSSARIO).sort(), IDS);
    for (const [id, t] of Object.entries(GLOSSARIO)) {
        assert.ok(t.termo && t.definicao, id);
        assert.doesNotMatch(t.termo + t.definicao, /[–—]/, id);
        const frases = t.definicao.split(/(?<=[.!?])\s+/).filter(Boolean).length;
        assert.ok(frases >= 1 && frases <= 2, `${id}: ${frases} frases`);
        assert.ok(t.definicao.length <= 280, id);
    }
    const termos = Object.values(GLOSSARIO).map((t) => t.termo);
    assert.deepEqual(termos, [...termos].sort((a, b) => a.localeCompare(b, 'pt-BR')));
});

test('glossário: todo <AjudaTermo id="..."> das telas existe; nada no portal', () => {
    const dir = new URL('../components/secretaria/', import.meta.url);
    const ler = (u) => readFileSync(u, 'utf8');
    const arqs = [...readdirSync(dir).filter((f) => f.endsWith('.jsx')).map((f) => new URL(f, dir)), new URL('../pages/ProcessoEletronico.jsx', import.meta.url)];
    const usados = arqs.flatMap((u) => [...ler(u).matchAll(/<AjudaTermo id="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(usados.length >= 10, `só ${usados.length} usos`);
    for (const id of usados) assert.ok(GLOSSARIO[id], `termo desconhecido: ${id}`);
    for (const p of ['Portal.jsx', 'MeusProcessosEletronicos.jsx']) assert.doesNotMatch(ler(new URL(`../pages/${p}`, import.meta.url)), /AjudaTermo/, p);
    // Componentes que o portal desenha: nenhum "?" neles.
    for (const c of ['comum', 'FluxoRito', 'CamposProcesso', 'LeitorAutos', 'EventosAutos', 'ComunicacoesPendentes']) assert.doesNotMatch(ler(new URL(`${c}.jsx`, dir)), /AjudaTermo/, c);
});
