// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Copia os dados da ONU, e faz teste de ONU LOSS (Com Serial)
// @author       Joao Augusto
// @icon         https://avatars.githubusercontent.com/u/179055349?v=4
// @match        https://autoisp.gegnet.com.br/contracted_services/*
// @match        https://autoisp.gegnet.com.br/gpon_clients/*
// @match        https://autoisp.acessoline.net.br/contracted_services/*
// @match        https://autoisp.acessoline.net.br/gpon_clients/*
// @grant        GM_setClipboard
// ==/UserScript==
// --- ESTRATÉGIA DE ATUALIZAÇÃO ---
// @updateURL    https://raw.githubusercontent.com/joaoAGS/Copiar-Dados-ONU---JoaoAGS/main/Copiar%20Dados%20ONU%20-%20JoaoAGS.user.js
// @downloadURL  https://raw.githubusercontent.com/joaoAGS/Copiar-Dados-ONU---JoaoAGS/main/Copiar%20Dados%20ONU%20-%20JoaoAGS.user.js
//
// ==/UserScript==

(function () {
    'use strict';

    // --- UTILITÁRIOS ---
    function clean(str) { return str ? str.replace(/\s+/g, ' ').trim() : ''; }

    function validarSinal(str) {
        if (!str) return null;
        let normalizado = str.replace(/[\u2013\u2014\u2212]/g, '-');
        const match = normalizado.match(/(-?\d+[\.,]\d+)/);
        if (match) {
            let num = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(num)) {
                if (num > 0) num = -num;
                if (num < -1 && num > -90) return num.toFixed(2) + ' dBm';
            }
        }
        return null;
    }

    function obterTexto(el) {
        if (!el) return '';
        if (el.tagName === 'INPUT') return el.value.trim();
        const clone = el.cloneNode(true);
        clone.querySelectorAll('i, svg, .badge').forEach(x => x.remove());
        return clean(clone.textContent);
    }

    // --- NAVEGAÇÃO SEGURA ---
    function trocarAba(nomeAba) {
        const todosLinks = Array.from(document.querySelectorAll('a'));

        // Filtro 1: Tenta achar links que pareçam abas
        let linkAlvo = todosLinks.find(a => {
            const texto = clean(a.textContent);
            const ehAba = a.classList.contains('nav-link') || a.closest('ul.nav') || a.closest('.tabs');
            return ehAba && texto === nomeAba;
        });

        // Filtro 2: Nome exato
        if (!linkAlvo) {
            linkAlvo = todosLinks.find(a => clean(a.textContent) === nomeAba);
        }

        // Filtro 3: Contém nome
        if (!linkAlvo) {
            linkAlvo = todosLinks.find(a => clean(a.textContent).includes(nomeAba));
        }

        if (linkAlvo) {
            linkAlvo.click();
            return true;
        }
        return false;
    }

    // --- LEITURA RÁPIDA DA TABELA ---
    function lerTabelaHistorico() {
        const tables = document.getElementsByTagName('table');

        for (let i = 0; i < tables.length; i++) {
            const tbl = tables[i];
            if (!tbl.innerText.toLowerCase().includes('onu rx anterior')) continue;

            const headers = Array.from(tbl.querySelectorAll('th')).map(h => clean(h.textContent).toLowerCase());
            const idxData = headers.findIndex(h => h.includes('data'));
            const idxRxAnt = headers.findIndex(h => h.includes('anterior'));
            const idxRx = headers.findIndex(h => h === 'onu rx' || h === 'rx');

            const rows = tbl.querySelectorAll('tbody tr');
            if (rows.length === 0) continue;

            let dataRecente = (idxData >= 0) ? obterTexto(rows[0].cells[idxData]) : '–';

            for (const row of rows) {
                const cells = row.cells;
                if (idxRxAnt >= 0 && cells[idxRxAnt]) {
                    const s = validarSinal(obterTexto(cells[idxRxAnt]));
                    if (s) return { sinal: s, data: (idxData >= 0 ? obterTexto(cells[idxData]) : dataRecente) };
                }
                if (idxRx >= 0 && cells[idxRx]) {
                    const s = validarSinal(obterTexto(cells[idxRx]));
                    if (s) return { sinal: s, data: (idxData >= 0 ? obterTexto(cells[idxData]) : dataRecente) };
                }
            }
        }
        return null;
    }

    // --- PROCESSADOR TURBO ---
    function iniciarBuscaTurbo(callback) {
        let dados = lerTabelaHistorico();
        if (dados) { callback(dados); return; }

        if (!trocarAba('Diagnóstico GPON')) {
            alert('Erro: Aba Diagnóstico GPON não encontrada.');
            callback(null);
            return;
        }

        let tentativas = 0;
        const intervalo = setInterval(() => {
            tentativas++;
            dados = lerTabelaHistorico();

            if (dados) {
                clearInterval(intervalo);
                trocarAba('Geral');
                callback(dados);
            }
            else if (tentativas > 60) {
                clearInterval(intervalo);
                trocarAba('Geral');
                callback(null);
            }
        }, 50);
    }

    function buscarDadoPorLabel(labels) {
        if (!Array.isArray(labels)) labels = [labels];
        for (const label of labels) {
            const xpath = `//*[contains(text(), '${label}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < result.snapshotLength; i++) {
                const el = result.snapshotItem(i);
                if (['SCRIPT', 'STYLE', 'BUTTON'].includes(el.tagName)) continue;
                if (el.tagName === 'TH' || el.tagName === 'TD') {
                    const row = el.closest('tr');
                    if (row && row.cells) {
                        const cells = Array.from(row.cells);
                        const idx = cells.indexOf(el);
                        if (cells[idx + 1]) return obterTexto(cells[idx + 1]);
                    }
                }
                if (el.nextElementSibling) return obterTexto(el.nextElementSibling);
            }
        }
        return '';
    }

    // --- FUNÇÃO PARA PEGAR SERIAL LIMPO ---
    function pegarSerialLimpo() {
        // Tenta pegar pelo label padrão
        let serial = buscarDadoPorLabel(['Serial', 'Serial:', 'Serial Number', 'ID do Fabricante']);

        // Se não achou, tenta pegar pelo estilo visual (comum no card principal)
        if (!serial) {
            const el = document.querySelector('.w-100.text-end[style*="14pt"]');
            if (el) serial = el.textContent.trim();
        }

        // LIMPEZA: Remove "N/A -> " ou pega só a parte final se tiver seta
        if (serial && serial.includes('->')) {
            const partes = serial.split('->');
            serial = partes[partes.length - 1].trim(); // Pega o último pedaço
        }

        return serial || 'Não identificado';
    }

    function gerarRelatorio(dadosExtra) {
        const descOLT = buscarDadoPorLabel(['Descrição na OLT', 'Local:']);
        const olt = buscarDadoPorLabel(['OLT', 'OLT:']);
        const pon = buscarDadoPorLabel(['PON Link']);
        const onuid = buscarDadoPorLabel(['ONU ID']);
        const servicePort = buscarDadoPorLabel(['Service Port']);
        const vlan = buscarDadoPorLabel(['VLAN (do perfil)', 'VLAN:']);
        const modelo = buscarDadoPorLabel(['Modelo de ONU', 'Modelo:']);

        // Pega o serial usando a função de limpeza
        const serial = pegarSerialLimpo();

        const ultimoSinal = (dadosExtra && dadosExtra.sinal) ? dadosExtra.sinal : '–';
        const dataQueda = (dadosExtra && dadosExtra.data) ? dadosExtra.data : '–';

        const msgLoss = [
            '',
            '--- TESTES CSA / ROTEADOR / ONU ---',
            'Verificado ONU DOWN (LINK LOSS)',
            `Local: ${descOLT}`,
            `Link: ${olt} ${pon} ID ${onuid}`,
            `Service Port: ${servicePort}`,
            `VLAN: ${vlan}`,
            `Modelo da ONU: ${modelo || 'Não identificado'}`,
            `Serial: ${serial}`,  // <--- CAMPO ADICIONADO AQUI
            `Plano desconectado desde: ${dataQueda}`,
            `Último sinal ONU: ${ultimoSinal}`,
            'Demais clientes da caixa estão UP',
            'Energia confirmada',
            'Equipamentos reiniciados sem sucesso',
            'Cabos verificados',
            '',
            '--- LOGÍSTICA / O.S. ---',
            'Cliente sem acesso, ONU DOWN com link loss.',
            'Encaminhar técnico.'
        ].join('\n');

        GM_setClipboard(msgLoss);
    }

    function criarBotao(id, texto, cor, aoClicar) {
        if (document.getElementById(id)) return;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = texto;
        btn.className = `btn btn-${cor}`;
        btn.style.margin = '5px 5px 5px 0';
        const container = document.querySelector('.general-buttons-wrapper.card-body');
        if (container) container.appendChild(btn);
        else {
            Object.assign(btn.style, { position: 'fixed', top: '60px', right: '10px', zIndex: '9999' });
            document.body.appendChild(btn);
        }
        btn.addEventListener('click', (e) => { e.preventDefault(); aoClicar(btn); });
    }

    function executarScript() {
        const rxOnuAtual = buscarDadoPorLabel(['Atenuação Rx ONU', 'Sinal ONU']);
        const isLoss = !validarSinal(rxOnuAtual) || /(loss|los|sem sinal|down)/i.test(rxOnuAtual);

        criarBotao('btn-copiar-onu', '📋 Copiar Dados', 'success', (btn) => {
            const descOLT = buscarDadoPorLabel(['Descrição na OLT', 'Local:']);
            const olt = buscarDadoPorLabel(['OLT', 'OLT:']);
            const pon = buscarDadoPorLabel(['PON Link']);
            const onuid = buscarDadoPorLabel(['ONU ID']);
            const servicePort = buscarDadoPorLabel(['Service Port']);
            const vlan = buscarDadoPorLabel(['VLAN (do perfil)', 'VLAN:']);
            const modelo = buscarDadoPorLabel(['Modelo de ONU', 'Modelo:']);

            const serial = pegarSerialLimpo(); // Usa função limpa

            let firmware = buscarDadoPorLabel(['Firmware da ONU', 'Firmware:']).replace(/(valid|invalid).*?committed/gi,'').trim();
            const rxOltAtual = buscarDadoPorLabel(['Atenuação Rx OLT', 'Sinal OLT']);
            const uptime = buscarDadoPorLabel(['Uptime da ONU', 'Uptime:']);
            const alarmes = buscarDadoPorLabel(['Alarmes']);

            const linhas = [
                '[DADOS DA ONU]',
                `Local: ${descOLT}`,
                `Link: ${olt} ${pon} ID ${onuid}`,
                `Service Port: ${servicePort}`,
                `VLAN: ${vlan}`,
                `Modelo: ${modelo}`,
                `Serial: ${serial}`,
                `Firmware: ${firmware}`,
                `Rx ONU: ${rxOnuAtual} (${isLoss ? 'DOWN' : 'UP'})`,
                `Rx OLT: ${rxOltAtual}`,
                `Uptime: ${uptime}`
            ];
            if (isLoss) linhas.push(`Alarmes: ${alarmes || 'Sem info'}`);

            GM_setClipboard(linhas.join('\n'));
            const orig = btn.innerHTML;
            btn.innerHTML = 'Copiado!';
            setTimeout(() => btn.innerHTML = orig, 1000);
        });

        if (isLoss) {
            criarBotao('btn-onu-down', '🚨 Teste ONU LOSS', 'danger', (btn) => {
                const orig = btn.innerHTML;
                btn.innerHTML = '⚡';
                btn.disabled = true;

                iniciarBuscaTurbo((dados) => {
                    gerarRelatorio(dados);
                    btn.innerHTML = 'Copiado!';
                    btn.disabled = false;
                    setTimeout(() => btn.innerHTML = orig, 1500);
                });
            });
        }
    }

    window.addEventListener('load', () => setTimeout(executarScript, 800));
})();