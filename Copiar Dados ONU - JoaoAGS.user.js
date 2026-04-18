// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS (Ajustado)
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Copia os dados da ONU, e faz teste de ONU LOSS com seletores atualizados
// @author       Joao Augusto
// @match        https://autoisp.gegnet.com.br/contracted_services/*
// @match        https://autoisp.gegnet.com.br/gpon_clients/*
// @match        https://autoisp.acessoline.net.br/contracted_services/*
// @match        https://autoisp.acessoline.net.br/gpon_clients/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // --- UTILITÁRIOS ---
    const clean = (str) => str ? str.replace(/\s+/g, ' ').trim() : '';

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
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value.trim();
        const clone = el.cloneNode(true);
        clone.querySelectorAll('i, svg, .badge, script, style').forEach(x => x.remove());
        return clean(clone.textContent);
    }

    // --- NAVEGAÇÃO ---
    function trocarAba(nomeAba) {
        const links = Array.from(document.querySelectorAll('.nav-link, .tabs a, a'));
        const alvo = links.find(a => clean(a.textContent).toLowerCase().includes(nomeAba.toLowerCase()));
        if (alvo) {
            alvo.click();
            return true;
        }
        return false;
    }

    // --- BUSCA DE DADOS ---
    function buscarDadoPorLabel(labels) {
        if (!Array.isArray(labels)) labels = [labels];
        
        for (const label of labels) {
            // Busca o elemento que contém o texto exato ou aproximado
            const xpath = `//th[contains(text(),'${label}')] | //td[contains(text(),'${label}')] | //label[contains(text(),'${label}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            if (result) {
                // Tenta pegar o próximo TD ou o elemento pai se for uma estrutura de grid
                let valor = "";
                if (result.nextElementSibling) {
                    valor = obterTexto(result.nextElementSibling);
                } else if (result.parentElement.nextElementSibling) {
                    valor = obterTexto(result.parentElement.nextElementSibling);
                }
                if (valor) return valor;
            }
        }
        return '';
    }

    function pegarSerialLimpo() {
        // Estratégia 1: Procura o serial grande no cabeçalho (comum no Auto ISP)
        const badges = Array.from(document.querySelectorAll('.badge, .text-end, h3, h4'));
        const serialRegex = /^[A-Z0-9]{4}[A-Z0-9]{8,12}$/;
        
        for (let b of badges) {
            let txt = clean(b.textContent).replace(/[^A-Z0-9]/gi, '');
            if (serialRegex.test(txt)) return txt;
        }

        // Estratégia 2: Tabela de informações
        let serial = buscarDadoPorLabel(['Serial', 'SN', 'ID do Fabricante']);
        return serial.includes('->') ? serial.split('->').pop().trim() : serial;
    }

    // --- LÓGICA DE HISTÓRICO ---
    function lerTabelaHistorico() {
        const tabelas = Array.from(document.querySelectorAll('table'));
        const tbl = tabelas.find(t => t.innerText.toLowerCase().includes('rx'));
        
        if (!tbl) return null;
        const rows = tbl.querySelectorAll('tbody tr');
        if (!rows.length) return null;

        const cells = rows[0].cells;
        // Tenta pegar o sinal da primeira linha (mais recente)
        for (let cell of cells) {
            let s = validarSinal(obterTexto(cell));
            if (s) return { sinal: s, data: obterTexto(cells[0]) };
        }
        return null;
    }

    // --- UI E EXECUÇÃO ---
    function criarBotao(id, texto, cor, aoClicar) {
        if (document.getElementById(id)) return;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = texto;
        btn.className = `btn btn-sm btn-${cor}`;
        btn.style.cssText = 'margin: 5px; font-weight: bold; border-radius: 4px;';
        
        const container = document.querySelector('.card-header .float-end, .general-buttons-wrapper');
        if (container) container.prepend(btn);
        else {
            btn.style.cssText += 'position:fixed; top:70px; right:10px; z-index:9999;';
            document.body.appendChild(btn);
        }
        
        btn.onclick = (e) => { e.preventDefault(); aoClicar(btn); };
    }

    function montarECopiar(isLoss, dadosExtra = null) {
        const dados = {
            local: buscarDadoPorLabel(['Descrição', 'Local']),
            link: `${buscarDadoPorLabel(['OLT'])} ${buscarDadoPorLabel(['PON'])} ID ${buscarDadoPorLabel(['ONU ID'])}`,
            sp: buscarDadoPorLabel(['Service Port']),
            vlan: buscarDadoPorLabel(['VLAN']),
            modelo: buscarDadoPorLabel(['Modelo']),
            serial: pegarSerialLimpo(),
            rx: buscarDadoPorLabel(['Atenuação Rx ONU', 'Sinal ONU']) || 'N/A'
        };

        let relatorio = "";
        if (isLoss) {
            relatorio = [
                '--- TESTES ONU LOSS ---',
                `Local: ${dados.local}`,
                `Link: ${dados.link}`,
                `Serial: ${dados.serial}`,
                `Modelo: ${dados.modelo}`,
                `VLAN: ${dados.vlan}`,
                `Último Sinal: ${dadosExtra?.sinal || 'Sem histórico'}`,
                `Queda registrada: ${dadosExtra?.data || 'N/A'}`,
                '------------------------',
                'ONU DOWN (Link Loss). Energia OK, cabos revisados.'
            ].join('\n');
        } else {
            relatorio = [
                '[DADOS DA ONU]',
                `Local: ${dados.local}`,
                `Link: ${dados.link}`,
                `Serial: ${dados.serial}`,
                `Sinal: ${dados.rx}`,
                `VLAN: ${dados.vlan}`
            ].join('\n');
        }

        GM_setClipboard(relatorio);
    }

    function iniciar() {
        const rx = buscarDadoPorLabel(['Atenuação Rx ONU', 'Sinal ONU']);
        const isLoss = !validarSinal(rx) || /loss|down|sem/i.test(rx);

        criarBotao('btn-copy-ags', '📋 Copiar Dados', 'primary', (btn) => {
            montarECopiar(false);
            btn.innerHTML = '✅ Copiado!';
            setTimeout(() => btn.innerHTML = '📋 Copiar Dados', 2000);
        });

        if (isLoss) {
            criarBotao('btn-loss-ags', '🚨 LOSS', 'danger', (btn) => {
                const original = btn.innerHTML;
                btn.innerHTML = '⌛ Aguarde...';
                
                if (trocarAba('Diagnóstico')) {
                    setTimeout(() => {
                        const h = lerTabelaHistorico();
                        trocarAba('Geral');
                        montarECopiar(true, h);
                        btn.innerHTML = '✅ Relatório OK!';
                        setTimeout(() => btn.innerHTML = original, 2000);
                    }, 1500);
                } else {
                    montarECopiar(true);
                }
            });
        }
    }

    // Executa após um delay para garantir que o AJAX do site carregou os dados
    setTimeout(iniciar, 1500);
})();
