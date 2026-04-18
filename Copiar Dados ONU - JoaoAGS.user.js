// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS (V2.1 Imortal)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Painel flutuante com injeção persistente para sistemas SPA (AutoISP)
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
                
                if (el.tagName === 'TH' || el.tagName === 'TD') {
                    const row = el.closest('tr');
                    if (row && row.cells) {
                        const cells = Array.from(row.cells);
                        const idx = cells.indexOf(el);
                        if (cells[idx + 1]) return clean(cells[idx + 1].textContent);
                    }
                }
                if (el.nextElementSibling) return clean(el.nextElementSibling.textContent);
            }
        }
        return '';
    }

    function pegarSerialLimpo() {
        const elementosVisuais = Array.from(document.querySelectorAll('.text-end, .badge, h3, h4, b, strong'));
        const regexSerial = /^[A-Z0-9]{4}[A-Z0-9]{6,16}$/;
        
        for (const el of elementosVisuais) {
            const txt = clean(el.textContent).replace(/[^A-Z0-9]/gi, '');
            if (regexSerial.test(txt)) return txt;
        }

        let serial = buscarDado(['Serial', 'Serial Number', 'ID do Fabricante', 'SN']);
        if (serial.includes('->')) serial = serial.split('->').pop();
        return serial.replace(/N\/A/gi, '').trim() || 'Não identificado';
    }

    // --- HISTÓRICO EM BACKGROUND ---
    function extrairHistorico(doc) {
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
        const links = Array.from(document.querySelectorAll('a.nav-link, a.tab-link, a'));
        const abaDiag = links.find(a => clean(a.textContent).toLowerCase().includes('diagnóstico'));

        if (!abaDiag || !abaDiag.href || abaDiag.href.includes('#')) {
            return extrairHistorico(document);
        }

        try {
            const response = await fetch(abaDiag.href);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return extrairHistorico(doc);
        } catch (e) {
            return null;
        }
    }

    // --- GERAÇÃO DE RELATÓRIO ---
    async function gerarRelatorio(isLoss, btn) {
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '⏳ Copiando...';
        btn.disabled = true;

        const rxAtual = buscarDado(['Atenuação Rx ONU', 'Sinal ONU', 'Sinal']);
        const dados = {
            descOLT: buscarDado(['Descrição na OLT', 'Local:', 'Designação']),
            olt: buscarDado(['OLT', 'OLT:']),
            pon: buscarDado(['PON Link', 'Slot/Pon']),
            onuid: buscarDado(['ONU ID', 'ID:']),
            servicePort: buscarDado(['Service Port']),
            vlan: buscarDado(['VLAN (do perfil)', 'VLAN:']),
            modelo: buscarDado(['Modelo de ONU', 'Modelo:', 'Equipamento']),
            serial: pegarSerialLimpo(),
            rxAtual: rxAtual,
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
                `Link: ${dados.olt} | ${dados.pon} | ID ${dados.onuid}`,
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
                `Link: ${dados.olt} | ${dados.pon} | ID ${dados.onuid}`,
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
        }, 1500);
    }

    // --- UI: PAINEL FLUTUANTE PERSISTENTE ---
    function criarPainelUI() {
        if (document.getElementById('ags-panel-v2')) return;

        const rxAtual = buscarDado(['Atenuação Rx ONU', 'Sinal ONU', 'Sinal']);
        const isLoss = !validarSinal(rxAtual) || /(loss|los|sem sinal|down)/i.test(rxAtual) || rxAtual === '';

        const painel = document.createElement('div');
        painel.id = 'ags-panel-v2';
        painel.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #f8f9fa;
            border: 1px solid #ced4da;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            z-index: 2147483647; /* Força ficar na frente de tudo */
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: Arial, sans-serif;
            width: 220px;
        `;

        const titulo = document.createElement('div');
        titulo.innerHTML = '<b>⚙️ Tools ONU - AGS</b>';
        titulo.style.textAlign = 'center';
        titulo.style.fontSize = '14px';
        titulo.style.color = '#333';
        titulo.style.marginBottom = '5px';
        painel.appendChild(titulo);

        const btnCopiar = document.createElement('button');
        btnCopiar.innerHTML = '📋 Copiar Dados';
        btnCopiar.style.cssText = 'padding: 10px; border: none; border-radius: 5px; background: #0d6efd; color: white; font-weight: bold; cursor: pointer; font-size: 13px;';
        btnCopiar.onclick = () => gerarRelatorio(false, btnCopiar);
        painel.appendChild(btnCopiar);

        if (isLoss) {
            const btnLoss = document.createElement('button');
            btnLoss.innerHTML = '🚨 Relatório LOSS';
            btnLoss.style.cssText = 'padding: 10px; border: none; border-radius: 5px; background: #dc3545; color: white; font-weight: bold; cursor: pointer; font-size: 13px;';
            btnLoss.onclick = () => gerarRelatorio(true, btnLoss);
            painel.appendChild(btnLoss);
        }

        document.body.appendChild(painel);
    }

    // --- MOTOR DE MONITORAMENTO ---
    // Checa a cada 1 segundo se a página tem dados de ONU e se o painel sumiu
    setInterval(() => {
        const temDados = document.body.innerText.includes('OLT') && document.body.innerText.includes('Serial');
        const painelExiste = document.getElementById('ags-panel-v2');

        if (temDados && !painelExiste) {
            criarPainelUI();
        } else if (!temDados && painelExiste) {
            // Remove o painel se você sair da tela da ONU
            painelExiste.remove();
        }
    }, 1000);

})();
