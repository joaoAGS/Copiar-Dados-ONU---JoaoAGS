// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Copia os dados da ONU, e faz teste de ONU LOSS (Busca de Tabela Aprimorada)
// @author       Joao Augusto
// @icon         https://avatars.githubusercontent.com/u/179055349?v=4
// @match        https://autoisp.*.com.br/contracted_services/*
// @match        https://autoisp.*.com.br/gpon_clients/*
// @match        https://autoisp.brasiltecpar.com.br/contracted_services/*
// @match        https://autoisp.brasiltecpar.com.br/gpon_clients/*
// @grant        GM_setClipboard
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
        clone.querySelectorAll('i, svg, .badge, button').forEach(x => x.remove());
        return clean(clone.textContent);
    }

    // --- NAVEGAÇÃO SEGURA (MODO FANTASMA) ---
    function trocarAba(nomeAba) {
        const todosLinks = Array.from(document.querySelectorAll('a, button'));
        let linkAlvo = todosLinks.find(a => {
            const texto = clean(a.textContent);
            return (a.classList.contains('nav-link') || a.closest('.tabs')) && texto === nomeAba;
        });

        if (!linkAlvo) linkAlvo = todosLinks.find(a => clean(a.textContent) === nomeAba);
        if (linkAlvo) { linkAlvo.click(); return true; }
        return false;
    }

    // --- LEITURA DE TABELA (HISTÓRICO) ---
    function lerTabelaHistorico() {
        const tables = document.querySelectorAll('table');
        for (let tbl of tables) {
            const headers = Array.from(tbl.querySelectorAll('th')).map(h => clean(h.textContent).toLowerCase());

            // Procura colunas que tenham a ver com Data e Sinal (Rx)
            const idxData = headers.findIndex(h => h.includes('data') || h.includes('horário'));
            const idxRxAnt = headers.findIndex(h => h.includes('anterior'));
            const idxRx = headers.findIndex(h => h === 'onu rx' || h === 'rx' || h.includes('sinal'));

            if (idxData >= 0 && (idxRxAnt >= 0 || idxRx >= 0)) {
                const rows = tbl.querySelectorAll('tbody tr');
                if (rows.length === 0) continue;

                let dataRecente = obterTexto(rows[0].cells[idxData]) || '–';

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
        }
        return null;
    }

    // --- BUSCA RÁPIDA NO DOM ---
    function buscarDadoPorLabel(labels) {
        if (!Array.isArray(labels)) labels = [labels];
        for (const label of labels) {
            const xpath = `//*[text()='${label}' or contains(text(), '${label}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

            for (let i = 0; i < result.snapshotLength; i++) {
                const el = result.snapshotItem(i);
                if (['SCRIPT', 'STYLE', 'BUTTON'].includes(el.tagName)) continue;

                const cell = el.closest('th, td');
                if (cell) {
                    const row = cell.closest('tr');
                    if (row && row.cells) {
                        const idx = Array.from(row.cells).indexOf(cell);
                        if (row.cells[idx + 1]) return obterTexto(row.cells[idx + 1]);
                    }
                }
                if (el.nextElementSibling) return obterTexto(el.nextElementSibling);
            }
        }
        return '';
    }

    function pegarSerialLimpo() {
        const elementosVisuais = Array.from(document.querySelectorAll('.text-end, .text-right, [style*="text-align: right"], .float-right'));
        const serialVisual = elementosVisuais.find(el => {
            const txt = clean(el.textContent);
            return /^[A-Z0-9]{4}[A-Z0-9]{6,16}$/.test(txt) && !txt.includes('->') && !txt.includes(' ');
        });

        if (serialVisual) return clean(serialVisual.textContent);

        let serial = buscarDadoPorLabel(['Serial', 'Serial Number', 'ID do Fabricante']);
        if (!serial) return 'Não identificado';
        if (serial.includes('->')) serial = serial.split('->').pop();
        return serial.replace(/N\/A/gi, '').trim();
    }

    // --- CRIAÇÃO DOS BOTÕES ---
    function criarBotao(id, texto, cor, aoClicar) {
        if (document.getElementById(id)) return;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = texto;
        btn.className = `btn btn-${cor}`;
        btn.style.margin = '5px';

        const botoesDaPagina = Array.from(document.querySelectorAll('a, button'));
        const botaoReferencia = botoesDaPagina.find(el => {
            const txt = clean(el.textContent).toLowerCase();
            return txt.includes('autodiagnóstico') || txt.includes('atualizar') || txt.includes('reboot');
        });

        if (botaoReferencia && botaoReferencia.closest('div')) {
            botaoReferencia.closest('div').appendChild(btn);
        } else {
            Object.assign(btn.style, { position: 'fixed', top: '60px', right: '20px', zIndex: '9999' });
            document.body.appendChild(btn);
        }

        btn.addEventListener('click', (e) => { e.preventDefault(); aoClicar(btn); });
    }

    // --- EXECUÇÃO PRINCIPAL ---
    function iniciar() {
        const rxOnuAtual = buscarDadoPorLabel(['Atenuação Rx ONU', 'Sinal ONU', 'Sinal']);
        const isLoss = !validarSinal(rxOnuAtual) || /(loss|los|sem sinal|down)/i.test(rxOnuAtual);

        // Limpeza de Dados Específica BrasilTecpar
        let localCTO = buscarDadoPorLabel(['CTO', 'Descrição na OLT', 'Local:']);
        localCTO = localCTO.replace(/Info\/Detalhes/gi, '').trim(); // Remove lixo do botão

        let serial = pegarSerialLimpo();
        let modelo = buscarDadoPorLabel(['Modelo de ONU', 'Modelo:']);

        // Se a página não disser o modelo, o script adivinha pela marca do Serial
        if (!modelo || modelo === 'N/A' || modelo === '') {
            if (serial.startsWith('ZTEG')) modelo = 'ZTE';
            else if (serial.startsWith('HWTC')) modelo = 'Huawei';
            else if (serial.startsWith('FHTT')) modelo = 'Fiberhome';
            else if (serial.startsWith('ALCL')) modelo = 'Alcatel';
            else if (serial.startsWith('DSNW')) modelo = 'Datacom';
            else modelo = 'N/A';
        }

        criarBotao('btn-copiar-onu', '📋 Copiar Dados', 'success', (btn) => {
            const linhas = [
                '[DADOS DA ONU]',
                `Local: ${localCTO}`,
                `Link: ${buscarDadoPorLabel(['OLT'])} ${buscarDadoPorLabel(['PON Link'])} ID ${buscarDadoPorLabel(['ONU ID'])}`,
                `Service Port: ${buscarDadoPorLabel(['Service Port'])}`,
                `VLAN: ${buscarDadoPorLabel(['VLAN (do perfil)', 'VLAN:'])}`,
                `Modelo: ${modelo}`,
                `Serial: ${serial}`,
                `Firmware: ${buscarDadoPorLabel(['Firmware da ONU', 'Firmware:']).replace(/(valid|invalid).*?committed/gi,'').trim()}`,
                `Rx ONU: ${rxOnuAtual} (${isLoss ? 'DOWN' : 'UP'})`,
                `Rx OLT: ${buscarDadoPorLabel(['Atenuação Rx OLT', 'Sinal OLT'])}`,
                `Uptime: ${buscarDadoPorLabel(['Uptime da ONU', 'Uptime:'])}`
            ];

            GM_setClipboard(linhas.join('\n'));
            const orig = btn.innerHTML;
            btn.innerHTML = 'Copiado!';
            setTimeout(() => btn.innerHTML = orig, 1000);
        });

        if (isLoss) {
            criarBotao('btn-onu-down', '🚨 Teste ONU LOSS', 'danger', (btn) => {
                const orig = btn.innerHTML;
                btn.innerHTML = '⚡ A ler...';
                btn.disabled = true;

                // Vai ler a tabela na outra aba bem rápido
                let dadosHist = lerTabelaHistorico();

                if (!dadosHist) {
                    trocarAba('Diagnóstico PON');
                    let tentativas = 0;
                    const intervalo = setInterval(() => {
                        tentativas++;
                        dadosHist = lerTabelaHistorico();

                        if (dadosHist || tentativas > 40) { // Espera max 2 seg
                            clearInterval(intervalo);
                            trocarAba('Geral'); // Volta para a aba principal
                            gerarLoss(dadosHist);
                        }
                    }, 50);
                } else {
                    gerarLoss(dadosHist);
                }

                function gerarLoss(dados) {
                    const msgLoss = [
                        '--- TESTES CSA / ROTEADOR / ONU ---',
                        'Verificado ONU DOWN (LINK LOSS)',
                        `Local: ${localCTO}`,
                        `Link: ${buscarDadoPorLabel(['OLT'])} ${buscarDadoPorLabel(['PON Link'])} ID ${buscarDadoPorLabel(['ONU ID'])}`,
                        `Service Port: ${buscarDadoPorLabel(['Service Port'])}`,
                        `VLAN: ${buscarDadoPorLabel(['VLAN (do perfil)', 'VLAN:'])}`,
                        `Modelo da ONU: ${modelo}`,
                        `Serial: ${serial}`,
                        `Plano desconectado desde: ${dados ? dados.data : '–'}`,
                        `Último sinal ONU: ${dados ? dados.sinal : '–'}`,
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
                    btn.innerHTML = 'Copiado!';
                    btn.disabled = false;
                    setTimeout(() => btn.innerHTML = orig, 1500);
                }
            });
        }
    }

    // Espera inteligente que deteta os dados mal eles carregam
    let tentativasCarregamento = 0;
    const observerEspera = setInterval(() => {
        const text = document.body.innerText;
        if (/(Atenuação Rx ONU|OLT\s*\n*GRS-)/i.test(text)) {
            clearInterval(observerEspera);
            setTimeout(iniciar, 200); // Dá só 200ms extra para o navegador estabilizar a interface
        }
        tentativasCarregamento++;
        if (tentativasCarregamento > 50) {
            clearInterval(observerEspera);
            iniciar();
        }
    }, 100);

})();
