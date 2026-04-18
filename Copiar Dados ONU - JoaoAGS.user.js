// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS (V2.0 Definitivo)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Copia dados, faz teste LOSS em background e possui painel UI isolado.
// @author       Joao Augusto
// @match        https://autoisp.gegnet.com.br/*
// @match        https://autoisp.acessoline.net.br/*
// @grant        GM_setClipboard
// @icon         https://avatars.githubusercontent.com/u/179055349?v=4
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

    // --- EXTRATORES DE DADOS ---
    function buscarDado(labels, contexto = document) {
        const arrLabels = Array.isArray(labels) ? labels : [labels];
        for (const label of arrLabels) {
            const xpath = `//*[contains(text(), '${label}')]`;
            const result = document.evaluate(xpath, contexto, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < result.snapshotLength; i++) {
                const el = result.snapshotItem(i);
                if (['SCRIPT', 'STYLE', 'BUTTON'].includes(el.tagName)) continue;
                
                // Se for tabela
                if (el.tagName === 'TH' || el.tagName === 'TD') {
                    const row = el.closest('tr');
                    if (row && row.cells) {
                        const cells = Array.from(row.cells);
                        const idx = cells.indexOf(el);
                        if (cells[idx + 1]) return clean(cells[idx + 1].textContent);
                    }
                }
                // Se for label padrão
                if (el.nextElementSibling) return clean(el.nextElementSibling.textContent);
            }
        }
        return '';
    }

    function pegarSerialLimpo() {
        const elementosVisuais = Array.from(document.querySelectorAll('.text-end, .badge, h3, h4'));
        const regexSerial = /^[A-Z0-9]{4}[A-Z0-9]{6,16}$/;
        
        const serialVisual = elementosVisuais.find(el => {
            const txt = clean(el.textContent).replace(/[^A-Z0-9]/gi, '');
            return regexSerial.test(txt);
        });

        if (serialVisual) return clean(serialVisual.textContent).replace(/[^A-Z0-9]/gi, '');

        let serial = buscarDado(['Serial', 'Serial Number', 'ID do Fabricante']);
        if (serial.includes('->')) serial = serial.split('->').pop();
        return serial.replace(/N\/A/gi, '').trim() || 'Não identificado';
    }

    // --- LEITURA DE HISTÓRICO EM SEGUNDO PLANO (FETCH) ---
    function extrairHistoricoTabela(doc) {
        const tables = doc.getElementsByTagName('table');
        for (let i = 0; i < tables.length; i++) {
            const tbl = tables[i];
            if (!tbl.innerText.toLowerCase().includes('rx')) continue;

            const headers = Array.from(tbl.querySelectorAll('th')).map(h => clean(h.textContent).toLowerCase());
            const idxData = headers.findIndex(h => h.includes('data'));
            const idxRx = headers.findIndex(h => h.includes('rx') || h.includes('anterior'));

            const rows = tbl.querySelectorAll('tbody tr');
            for (const row of rows) {
                const cells = row.cells;
                if (idxRx >= 0 && cells[idxRx]) {
                    const s = validarSinal(clean(cells[idxRx].textContent));
                    if (s) return { 
                        sinal: s, 
                        data: (idxData >= 0 && cells[idxData]) ? clean(cells[idxData].textContent) : '–' 
                    };
                }
            }
        }
        return null;
    }

    async function buscarHistoricoSilencioso() {
        // Acha o link da aba Diagnóstico
        const links = Array.from(document.querySelectorAll('a.nav-link, a.tab-link'));
        const abaDiag = links.find(a => clean(a.textContent).toLowerCase().includes('diagnóstico'));

        if (!abaDiag || !abaDiag.href || abaDiag.href.includes('#')) {
            // Se não tem link de página nova, lê a tela atual
            return extrairHistoricoTabela(document);
        }

        try {
            // Baixa a página de diagnóstico invisivelmente
            const response = await fetch(abaDiag.href);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return extrairHistoricoTabela(doc);
        } catch (e) {
            console.error("Erro ao buscar histórico em background", e);
            return null;
        }
    }

    // --- GERAÇÃO DE RELATÓRIO ---
    async function gerarRelatorio(isLoss, btn) {
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '⏳ Processando...';
        btn.disabled = true;

        const dados = {
            descOLT: buscarDado(['Descrição na OLT', 'Local:']),
            olt: buscarDado(['OLT', 'OLT:']),
            pon: buscarDado(['PON Link']),
            onuid: buscarDado(['ONU ID']),
            servicePort: buscarDado(['Service Port']),
            vlan: buscarDado(['VLAN (do perfil)', 'VLAN:']),
            modelo: buscarDado(['Modelo de ONU', 'Modelo:']),
            serial: pegarSerialLimpo(),
            rxAtual: buscarDado(['Atenuação Rx ONU', 'Sinal ONU']),
            rxOlt: buscarDado(['Atenuação Rx OLT', 'Sinal OLT']),
            uptime: buscarDado(['Uptime da ONU', 'Uptime:']),
            firmware: buscarDado(['Firmware da ONU', 'Firmware:']).replace(/(valid|invalid).*?committed/gi,'').trim()
        };

        let relatorio = [];

        if (isLoss) {
            const hist = await buscarHistoricoSilencioso();
            relatorio = [
                '--- TESTES CSA / ROTEADOR / ONU ---',
                'Verificado ONU DOWN (LINK LOSS)',
                `Local: ${dados.descOLT}`,
                `Link: ${dados.olt} ${dados.pon} ID ${dados.onuid}`,
                `Service Port: ${dados.servicePort}`,
                `VLAN: ${dados.vlan}`,
                `Modelo da ONU: ${dados.modelo || 'Não identificado'}`,
                `Serial: ${dados.serial}`,
                `Plano desconectado desde: ${hist ? hist.data : '–'}`,
                `Último sinal ONU: ${hist ? hist.sinal : '–'}`,
                'Demais clientes da caixa estão UP',
                'Energia confirmada',
                'Equipamentos reiniciados sem sucesso',
                'Cabos verificados',
                '',
                '--- LOGÍSTICA / O.S. ---',
                'Cliente sem acesso, ONU DOWN com link loss.',
                'Encaminhar técnico.'
            ];
        } else {
            relatorio = [
                '[DADOS DA ONU]',
                `Local: ${dados.descOLT}`,
                `Link: ${dados.olt} ${dados.pon} ID ${dados.onuid}`,
                `Service Port: ${dados.servicePort}`,
                `VLAN: ${dados.vlan}`,
                `Modelo: ${dados.modelo}`,
                `Serial: ${dados.serial}`,
                `Firmware: ${dados.firmware}`,
                `Rx ONU: ${dados.rxAtual} (${validarSinal(dados.rxAtual) ? 'UP' : 'DOWN'})`,
                `Rx OLT: ${dados.rxOlt}`,
                `Uptime: ${dados.uptime}`
            ];
        }

        GM_setClipboard(relatorio.join('\n'));
        
        btn.innerHTML = '✅ Copiado!';
        setTimeout(() => {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }, 2000);
    }

    // --- UI: PAINEL FLUTUANTE ISOLADO ---
    function criarPainelUI() {
        if (document.getElementById('ags-panel')) return;

        const rxAtual = buscarDado(['Atenuação Rx ONU', 'Sinal ONU']);
        const isLoss = !validarSinal(rxAtual) || /(loss|los|sem sinal|down)/i.test(rxAtual);

        const painel = document.createElement('div');
        painel.id = 'ags-panel';
        painel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 2px solid #ccc;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
            width: 200px;
        `;

        const titulo = document.createElement('div');
        titulo.innerHTML = '🛠️ <b>Ferramentas ONU</b>';
        titulo.style.textAlign = 'center';
        titulo.style.fontSize = '14px';
        titulo.style.color = '#333';
        painel.appendChild(titulo);

        const btnCopiar = document.createElement('button');
        btnCopiar.innerHTML = '📋 Copiar Dados';
        btnCopiar.style.cssText = 'padding: 8px; border: none; border-radius: 4px; background: #28a745; color: white; font-weight: bold; cursor: pointer;';
        btnCopiar.onclick = () => gerarRelatorio(false, btnCopiar);
        painel.appendChild(btnCopiar);

        if (isLoss) {
            const btnLoss = document.createElement('button');
            btnLoss.innerHTML = '🚨 Teste LOSS';
            btnLoss.style.cssText = 'padding: 8px; border: none; border-radius: 4px; background: #dc3545; color: white; font-weight: bold; cursor: pointer;';
            btnLoss.onclick = () => gerarRelatorio(true, btnLoss);
            painel.appendChild(btnLoss);
        }

        document.body.appendChild(painel);
    }

    // Aguarda o site carregar os dados
    setTimeout(criarPainelUI, 1200);

})();
