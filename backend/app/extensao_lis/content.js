// Painel "Alchemypet" dentro do LaborLIS: busca o pedido pelo número e
// preenche as telas de paciente e de guia. Nunca clica em Salvar: quem lança
// confere e salva.
(() => {
  if (window.__alchemypetLis) return;
  window.__alchemypetLis = true;

  // ------------------------------------------------------------ utilidades
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[*:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  let host = null; // elemento do painel (fica fora das buscas)
  const doPainel = (el) => host && (el === host || host.contains(el));
  const visivel = (el) => {
    if (!el || doPainel(el) || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  };
  const depois = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const textoProprio = (el) =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join(' ');
  const CONTROLES = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea';

  // Elemento com o texto do rótulo (ex.: "Raça"), visível, fora do painel.
  function rotulos(texto) {
    const alvo = norm(texto);
    const achados = [];
    for (const el of document.body.querySelectorAll('label,span,div,p,strong,b,h1,h2,h3,h4,h5,h6,legend,th,td,a,li')) {
      if (doPainel(el)) continue;
      if (norm(textoProprio(el)) !== alvo && !(el.children.length === 0 && norm(el.textContent) === alvo)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      achados.push(el);
    }
    // <label> primeiro.
    return achados.sort((a, b) => (b.tagName === 'LABEL') - (a.tagName === 'LABEL'));
  }

  // Campos que pertencem a um rótulo: depois dele e antes do próximo rótulo
  // "irmão" (mesma tag e classe).
  function campos(texto) {
    for (const rot of rotulos(texto)) {
      if (rot.tagName === 'LABEL' && rot.htmlFor) {
        const alvo = document.getElementById(rot.htmlFor);
        if (alvo && visivel(alvo)) {
          const resto = camposAposRotulo(rot);
          return [alvo, ...resto.filter((x) => x !== alvo)];
        }
      }
      const lista = camposAposRotulo(rot);
      if (lista.length) return lista;
    }
    return [];
  }
  // Percorre a página depois do rótulo: junta os campos até aparecer o
  // próximo texto visível (o rótulo do campo seguinte).
  function camposAposRotulo(rot) {
    const lista = [];
    const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    andar.currentNode = rot;
    let passos = 0;
    // Pula o conteúdo do próprio rótulo.
    let n = rot;
    while (n && !n.nextSibling && n.parentNode) n = n.parentNode;
    andar.currentNode = rot.lastChild || rot;
    for (let no = andar.nextNode(); no && passos < 400; no = andar.nextNode(), passos++) {
      if (rot.contains(no)) continue;
      if (no.nodeType === Node.TEXT_NODE) {
        const pai = no.parentElement;
        const t = no.textContent.trim();
        if (!t || !pai || pai.closest('select,option,textarea,[role=listbox]') || doPainel(pai)) continue;
        if (pai.closest('button') && t.replace(/[+\s]/g, '').length < 3) continue; // botão de ícone ("+")
        const r = pai.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (lista.length || passos > 3) break;
        continue;
      }
      if (doPainel(no)) continue;
      if (no.matches(CONTROLES) && visivel(no)) {
        lista.push(no);
        if (lista.length >= 4) break;
      }
    }
    return lista;
  }

  // Muda o valor como se fosse digitado (funciona com React, Vue e Angular).
  function definir(el, valor) {
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function tecla(el, key) {
    const codigo = { Enter: 13, Tab: 9, ArrowDown: 40 }[key] || 0;
    for (const tipo of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(tipo, { key, code: key, keyCode: codigo, which: codigo, bubbles: true }));
    }
  }
  function sair(el) {
    el.dispatchEvent(new Event('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  // Itens de lista suspensa visíveis (resultado de busca, opções).
  const ITENS = 'li,[role=option],.dropdown-item,.list-group-item,.autocomplete-item,.ui-menu-item,.select2-results__option,.vs__dropdown-option,.ng-option,.multiselect__option,.v-list-item,.mat-option,tbody tr';
  const itensVisiveis = () => Array.from(document.querySelectorAll(ITENS)).filter((x) => visivel(x) && norm(x.textContent));

  async function escolherOpcao(el, padrao) {
    if (el.tagName === 'SELECT') {
      const op = Array.from(el.options).find((o) => padrao.test(norm(o.textContent)) || padrao.test(norm(o.value)));
      if (!op) return false;
      definir(el, op.value);
      return true;
    }
    const antes = new Set(itensVisiveis());
    el.click();
    await esperar(400);
    const novo = itensVisiveis().find((x) => !antes.has(x) && padrao.test(norm(x.textContent)));
    if (!novo) return false;
    novo.click();
    return true;
  }

  // Campo de código + busca (Raça, Espécie, Solicitante...): digita o código
  // e confirma; o LIS completa o nome ao lado.
  async function codigoComBusca(lista, codigo) {
    const [cod, nome] = lista;
    definir(cod, codigo);
    tecla(cod, 'Enter');
    sair(cod);
    await esperar(1200);
    return !nome || !!nome.value.trim();
  }

  // Busca por nome com lista de resultados: escolhe se só houver um.
  async function buscarNome(el, texto) {
    const antes = new Set(itensVisiveis());
    definir(el, texto);
    tecla(el, 'ArrowDown');
    await esperar(1500);
    const novos = itensVisiveis().filter((x) => !antes.has(x));
    if (novos.length === 1) {
      novos[0].click();
      await esperar(400);
      return 'escolhido';
    }
    return novos.length ? 'varios' : 'nada';
  }

  async function ligar(texto) {
    for (const rot of rotulos(texto)) {
      let caixa = rot.parentElement;
      for (let i = 0; i < 3 && caixa; i++, caixa = caixa.parentElement) {
        const chk = caixa.querySelector('input[type=checkbox]');
        if (chk && !doPainel(chk)) {
          if (!chk.checked) {
            (rot.tagName === 'LABEL' ? rot : chk).click();
            await esperar(200);
            if (!chk.checked) chk.click();
          }
          return chk.checked;
        }
      }
    }
    return false;
  }

  function botao(texto) {
    const alvo = norm(texto);
    return Array.from(document.querySelectorAll('button,a,[role=button],input[type=button]')).find(
      (b) => visivel(b) && norm(b.textContent || b.value).replace(/^\+\s*/, '') === alvo,
    );
  }
  function aba(texto) {
    const alvo = norm(texto);
    const achados = Array.from(document.querySelectorAll('a,button,li,[role=tab]')).filter(
      (b) => visivel(b) && norm(b.textContent) === alvo,
    );
    // O mais interno (o <a> dentro do <li>), que é o que recebe o clique.
    return achados.find((b) => !achados.some((o) => o !== b && b.contains(o)));
  }

  // --------------------------------------------------------------- preencher
  async function preencherPaciente(p, log) {
    const pac = p.paciente;
    const nome = campos('Nome')[0];
    if (nome) {
      definir(nome, pac.nome);
      log.ok('Nome', pac.nome);
    } else log.falta('Nome');

    if (await ligar('Animal')) log.ok('Animal', 'ligado');
    else log.aviso('Animal', 'ligue a chave "Animal"');

    const sexo = campos('Sexo biológico')[0] || campos('Sexo')[0];
    if (pac.sexo && sexo) {
      const padrao = pac.sexo === 'M' ? /^(m|macho|masc)/ : /^(f|femea|fem)/;
      if (await escolherOpcao(sexo, padrao)) log.ok('Sexo', pac.sexo === 'M' ? 'Macho' : 'Fêmea');
      else log.aviso('Sexo', `escolha ${pac.sexo === 'M' ? 'macho' : 'fêmea'}`);
    } else if (pac.sexo) log.falta('Sexo biológico');

    const anos = pac.idade_anos || 0;
    const meses = pac.idade_meses || 0;
    const idade = campos('Idade')[0];
    if (idade && (anos || meses)) {
      definir(idade, String(anos || meses));
      const unidade = campos('Calcular Idade em')[0];
      let txt = anos ? `${anos} ano(s)` : `${meses} mês(es)`;
      if (unidade && !(await escolherOpcao(unidade, anos ? /^ano/ : /^mes/))) txt += ' (confira "Calcular idade em")';
      log.ok('Idade', txt + (anos && meses ? ` e ${meses} mês(es)` : ''));
    } else if (anos || meses) log.falta('Idade');

    for (const [rotulo, item] of [['Espécie', pac.especie], ['Raça', pac.raca]]) {
      const lista = campos(rotulo);
      if (!item.nome) continue;
      if (!lista.length) {
        log.falta(rotulo);
        continue;
      }
      if (item.codigo && (await codigoComBusca(lista, item.codigo))) log.ok(rotulo, `${item.codigo} · ${item.nome}`);
      else if (lista[1]) {
        const r = await buscarNome(lista[1], item.nome);
        if (r === 'escolhido') log.ok(rotulo, item.nome);
        else log.aviso(rotulo, `busque "${item.nome}" e escolha na lista`);
      } else log.aviso(rotulo, `não confirmou o código ${item.codigo}`);
    }

    const vet = campos('Médico padrão');
    if (vet.length && p.solicitante.nome) {
      const r = await buscarNome(vet[vet.length - 1], p.solicitante.nome);
      if (r === 'escolhido') log.ok('Médico padrão', p.solicitante.nome);
      else log.aviso('Médico padrão', `${p.solicitante.nome}${p.solicitante.crmv ? ' (CRMV ' + p.solicitante.crmv + ')' : ''}: escolha na lista ou cadastre`);
    }

    const resp = campos('Responsável');
    if (resp.length && p.responsavel.nome) {
      const busca = resp[resp.length - 1];
      let r = p.responsavel.cpf ? await buscarNome(busca, p.responsavel.cpf) : 'nada';
      if (r !== 'escolhido') r = await buscarNome(busca, p.responsavel.nome);
      if (r === 'escolhido') log.ok('Responsável', p.responsavel.nome);
      else log.aviso('Responsável', `${p.responsavel.nome}${p.responsavel.cpf ? ' · CPF ' + p.responsavel.cpf : ''}: escolha na lista ou clique em + para cadastrar`);
    }
  }

  async function preencherTextoEmAba(nomeAba, texto) {
    const a = aba(nomeAba);
    if (!a) return false;
    a.click();
    await esperar(400);
    const caixa = Array.from(document.querySelectorAll('textarea')).find((t) => visivel(t));
    if (!caixa) return false;
    const atual = caixa.value.trim();
    if (!atual.includes(texto.split('\n')[0])) definir(caixa, atual ? atual + '\n' + texto : texto);
    return true;
  }

  async function preencherGuia(p, log) {
    const pac = campos('Paciente');
    const buscaPac = pac[pac.length - 1];
    if (buscaPac && !buscaPac.value.trim()) {
      const r = await buscarNome(buscaPac, p.paciente.nome);
      if (r === 'escolhido') log.ok('Paciente', p.paciente.nome);
      else log.aviso('Paciente', `escolha "${p.paciente.nome}" (tutor ${p.responsavel.nome})`);
    } else if (buscaPac) log.ok('Paciente', 'já escolhido');

    const plano = campos('Plano');
    if (plano.length && !plano.some((c) => c.value.trim())) {
      log.aviso('Plano', 'escolha o Plano (convênio): sem ele o LIS não lista os exames');
    }

    const sol = campos('Solicitante');
    if (sol.length && p.solicitante.nome) {
      const r = await buscarNome(sol[sol.length - 1], p.solicitante.nome);
      if (r === 'escolhido') log.ok('Solicitante', p.solicitante.nome);
      else log.aviso('Solicitante', `${p.solicitante.nome}${p.solicitante.crmv ? ' (CRMV ' + p.solicitante.crmv + ')' : ''}: escolha na lista ou cadastre`);
    } else if (p.solicitante.nome) log.falta('Solicitante');

    if (await preencherTextoEmAba('Observações', p.observacoes)) log.ok('Observações', `Pedido Nº ${p.numero_fmt}`);
    else log.falta('Observações');
    if (p.suspeita && (await preencherTextoEmAba('Hipótese Diagnóstica', p.suspeita))) log.ok('Hipótese diagnóstica', p.suspeita);
    if (p.medicamentos && (await preencherTextoEmAba('Medicamentos', p.medicamentos))) log.ok('Medicamentos', p.medicamentos);
    const obs = aba('Observações');
    if (obs) obs.click();
  }

  // Exames: "Incluir" abre o quadro "Incluir exame" (busca do exame + material).
  // O LIS só lista exames depois que o Plano (convênio) da guia foi escolhido.
  const semConvenio = () => /nenhum exame disponivel/.test(norm(document.body.innerText));
  function campoDoExame() {
    const titulo = rotulos('Incluir exame')[0];
    if (!titulo) return null;
    return camposAposRotulo(titulo).find((c) => c.tagName === 'INPUT') || null;
  }
  async function incluirExames(p, log) {
    const plano = campos('Plano');
    if (plano.length && !plano.some((c) => c.value.trim())) {
      log.aviso('Plano', 'escolha o Plano (convênio) da guia antes: sem ele o LIS não lista os exames');
      return;
    }
    for (const ex of p.exames) {
      let alvo = campoDoExame();
      if (!alvo) {
        const inc = botao('Incluir');
        if (!inc) {
          log.falta('Botão "Incluir"');
          return;
        }
        inc.click();
        await esperar(900);
        alvo = campoDoExame();
      }
      if (!alvo) {
        log.aviso(`Exame ${ex.codigo}`, 'não achei onde digitar o exame; use "Diagnóstico da tela"');
        return;
      }
      const antes = new Set(itensVisiveis());
      definir(alvo, ex.codigo);
      tecla(alvo, 'ArrowDown');
      await esperar(1400);
      if (semConvenio()) {
        log.aviso('Plano', 'o LIS diz "Nenhum exame disponível": escolha o Plano (convênio) da guia e tente de novo');
        return;
      }
      const opcoes = itensVisiveis().filter((x) => !antes.has(x));
      const exata = opcoes.find((x) => new RegExp(`(^|\\D)${ex.codigo}(\\D|$)`).test(x.textContent));
      if (exata) {
        exata.click();
        await esperar(900);
        log.ok(`Exame ${ex.codigo}`, ex.nome);
      } else if (opcoes.length) {
        log.aviso(`Exame ${ex.codigo}`, `${ex.nome}: escolha na lista e siga com os próximos`);
        return;
      } else {
        tecla(alvo, 'Enter');
        await esperar(900);
        log.aviso(`Exame ${ex.codigo}`, `${ex.nome}: confira se entrou`);
      }
    }
  }

  // -------------------------------------------------------------- diagnóstico
  // Estrutura da tela, sem os valores digitados (para ajustar a extensão).
  function diagnostico() {
    const caminho = (el) => {
      const partes = [];
      for (let x = el; x && x !== document.body && partes.length < 6; x = x.parentElement) {
        let p = x.tagName.toLowerCase();
        if (x.id) p += '#' + x.id;
        else if (typeof x.className === 'string' && x.className.trim()) p += '.' + x.className.trim().split(/\s+/).slice(0, 3).join('.');
        partes.unshift(p);
      }
      return partes.join(' > ');
    };
    const anterior = (el) => {
      for (let x = el, i = 0; x && i < 5; x = x.parentElement, i++) {
        let irmao = x.previousElementSibling;
        while (irmao) {
          const t = norm(irmao.textContent);
          if (t && t.length < 60) return irmao.textContent.trim().replace(/\s+/g, ' ');
          irmao = irmao.previousElementSibling;
        }
      }
      return '';
    };
    const controles = Array.from(document.querySelectorAll('input,select,textarea,button,[role=button],[role=tab],[contenteditable=true]'))
      .filter((el) => !doPainel(el))
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        tipo: el.type || '',
        id: el.id || '',
        name: el.name || '',
        classe: typeof el.className === 'string' ? el.className : '',
        placeholder: el.placeholder || '',
        aria: el.getAttribute('aria-label') || '',
        texto: ['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : '',
        rotulo: anterior(el),
        visivel: visivel(el),
        opcoes: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => o.textContent.trim()).slice(0, 15) : undefined,
        caminho: caminho(el),
      }));
    const copia = document.body.cloneNode(true);
    copia.querySelectorAll('#alchemypet-lis-painel,script,style,svg,img').forEach((x) => x.remove());
    copia.querySelectorAll('[value]').forEach((x) => x.removeAttribute('value'));
    copia.querySelectorAll('textarea').forEach((x) => (x.textContent = ''));
    const estruturas = [];
    document.querySelectorAll('[ng-version]').length && estruturas.push('angular');
    document.querySelector('[data-v-app],[data-v-]') && estruturas.push('vue');
    document.querySelector('[data-reactroot]') && estruturas.push('react');
    return JSON.stringify({
      endereco: location.pathname,
      titulo: document.title,
      estruturas,
      controles,
      html: copia.innerHTML.replace(/\s+/g, ' ').slice(0, 400000),
    });
  }

  // ------------------------------------------------------------------ painel
  const enviar = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => resolve(r || { erro: 'Sem resposta da extensão.' }));
      } catch (e) {
        resolve({ erro: 'A extensão foi atualizada: recarregue a página (F5).' });
      }
    });

  const CSS_PAINEL = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .bola { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; background: #512d78; color: #fff;
      border: 0; border-radius: 22px; padding: 10px 16px; font-size: 14px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    .painel { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; width: 360px; max-height: 82vh;
      overflow: auto; background: #fff; color: #1f2933; border-radius: 12px; box-shadow: 0 10px 34px rgba(0,0,0,.3);
      font-size: 13px; line-height: 1.4; }
    .topo { display: flex; align-items: center; justify-content: space-between; background: #512d78; color: #fff;
      padding: 10px 14px; border-radius: 12px 12px 0 0; position: sticky; top: 0; }
    .topo b { font-size: 14px; }
    .topo button { background: none; border: 0; color: #fff; font-size: 18px; cursor: pointer; }
    .corpo { padding: 12px 14px; }
    input { width: 100%; padding: 8px 10px; border: 1px solid #c9c2d6; border-radius: 7px; font-size: 14px; margin: 4px 0 8px; }
    .linha { display: flex; gap: 6px; }
    .linha input { margin: 0; }
    .btn { display: block; width: 100%; border: 0; border-radius: 7px; padding: 9px 10px; font-size: 13px; font-weight: 700;
      cursor: pointer; background: #512d78; color: #fff; margin-top: 6px; text-align: left; }
    .btn.sec { background: #efeaf6; color: #3b2160; }
    .btn.atual { outline: 3px solid #00aeef; }
    .btn:disabled { opacity: .55; cursor: wait; }
    .linha .btn { width: auto; margin: 0; white-space: nowrap; }
    .resumo { background: #f6f3fa; border-radius: 8px; padding: 8px 10px; margin: 6px 0 4px; }
    .resumo .num { font-size: 15px; font-weight: 800; color: #512d78; }
    .exames { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .exames span { background: #fff; border: 1px solid #d8cfe6; border-radius: 5px; padding: 1px 6px; font-size: 12px; cursor: copy; }
    .log { margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px; }
    .log div { padding: 2px 0; }
    .ok { color: #11743b; } .aviso { color: #a15c00; } .falta { color: #b42318; }
    .erro { color: #b42318; font-weight: 600; margin: 6px 0; }
    .lancado { background: #e7f6ec; color: #11743b; border-radius: 7px; padding: 6px 9px; margin-top: 8px; font-weight: 600; }
    .rodape { display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; color: #6b7280; }
    .rodape a { color: #512d78; cursor: pointer; text-decoration: underline; }
    small { color: #6b7280; }
  `;

  host = document.createElement('div');
  host.id = 'alchemypet-lis-painel';
  const raiz = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  let aberto = false;
  let ocupado = false;
  let linhasLog = [];
  let mensagem = '';

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tela = () => (/atendimento\/paciente/.test(location.pathname) ? 'paciente'
    : /atendimento\/guia/.test(location.pathname) ? 'guia' : '');

  async function desenhar() {
    const st = aberto ? await enviar({ acao: 'estado' }) : null;
    let html = `<style>${CSS_PAINEL}</style>`;
    if (!aberto) {
      raiz.innerHTML = html + '<button class="bola" data-a="abrir">Alchemypet</button>';
      return;
    }
    html += '<div class="painel"><div class="topo"><b>Alchemypet → LaborLIS</b><button data-a="fechar" title="Minimizar">–</button></div><div class="corpo">';
    if (st.erro) {
      html += `<div class="erro">${esc(st.erro)}</div>`;
    } else if (!st.logado) {
      html += `<div>Entre com o seu login do Alchemypet Integrado.</div>
        <input id="email" type="email" placeholder="E-mail" autocomplete="username">
        <input id="senha" type="password" placeholder="Senha" autocomplete="current-password">
        <button class="btn" data-a="login">Entrar</button>`;
    } else {
      const p = st.pedido;
      html += `<div class="linha"><input id="numero" placeholder="Nº do pedido ou código de barras" value=""><button class="btn" data-a="buscar">Buscar</button></div>`;
      if (p) {
        const pac = p.paciente;
        const idade = [pac.idade_anos ? pac.idade_anos + ' a' : '', pac.idade_meses ? pac.idade_meses + ' m' : ''].filter(Boolean).join(' ');
        html += `<div class="resumo"><div class="num">Pedido Nº ${esc(p.numero_fmt)}${p.urgente ? ' · URGENTE' : ''}</div>
          <div><b>${esc(pac.nome)}</b> · ${esc(pac.especie.nome)}${pac.raca.nome ? ' · ' + esc(pac.raca.nome) : ''} · ${esc(pac.sexo)} ${esc(idade)}</div>
          <div>Responsável: ${esc(p.responsavel.nome)}${p.responsavel.cpf ? ' · CPF ' + esc(p.responsavel.cpf) : ''}</div>
          <div>Veterinário: ${esc(p.solicitante.nome)}${p.solicitante.crmv ? ' · CRMV ' + esc(p.solicitante.crmv) : ''}</div>
          <div>Clínica: ${esc(p.clinica)}</div>
          <div class="exames" title="Clique para copiar o código">${p.exames.map((e) => `<span data-cod="${esc(e.codigo)}" title="${esc(e.nome)}">${esc(e.codigo)}</span>`).join('')}</div></div>
          <button class="btn ${tela() === 'paciente' ? 'atual' : 'sec'}" data-a="paciente">1. Preencher paciente <small>(Paciente › Novo)</small></button>
          <button class="btn ${tela() === 'guia' ? 'atual' : 'sec'}" data-a="guia">2. Preencher guia <small>(Guia › Nova)</small></button>
          <button class="btn ${tela() === 'guia' ? 'atual' : 'sec'}" data-a="exames">3. Incluir os ${p.exames.length} exames</button>`;
        html += p.lis && p.lis.lancado_em
          ? `<div class="lancado">✓ Lançado no LIS em ${esc(p.lis.lancado_em)} por ${esc(p.lis.lancado_por)} · <a data-a="desmarcar" style="cursor:pointer;text-decoration:underline">desfazer</a></div>`
          : '<button class="btn" data-a="marcar">4. Salvei no LIS: marcar como lançado</button>';
      } else {
        html += '<small>Digite o número do pedido (está no PDF e na etiqueta) ou passe o leitor no código de barras.</small>';
      }
      if (mensagem) html += `<div class="erro">${esc(mensagem)}</div>`;
      if (linhasLog.length) html += `<div class="log">${linhasLog.map((l) => `<div class="${l.c}">${l.t}</div>`).join('')}<small>Confira e clique em Salvar no LaborLIS.</small></div>`;
      html += `<div class="rodape"><span>${esc(st.usuario)}</span><span><a data-a="diag">Diagnóstico da tela</a> · ${p ? '<a data-a="limpar">Fechar pedido</a> · ' : ''}<a data-a="sair">Sair</a></span></div>`;
    }
    if (st.logado === false && mensagem) html += `<div class="erro">${esc(mensagem)}</div>`;
    html += '</div></div>';
    raiz.innerHTML = html;
    const num = raiz.getElementById('numero');
    if (num) {
      num.focus();
      num.addEventListener('keydown', (e) => e.key === 'Enter' && acao('buscar'));
    }
    const senha = raiz.getElementById('senha');
    if (senha) senha.addEventListener('keydown', (e) => e.key === 'Enter' && acao('login'));
  }

  function novoLog() {
    linhasLog = [];
    return {
      ok: (c, v) => linhasLog.push({ c: 'ok', t: `✓ <b>${esc(c)}</b>: ${esc(v)}` }),
      aviso: (c, v) => linhasLog.push({ c: 'aviso', t: `⚠ <b>${esc(c)}</b>: ${esc(v)}` }),
      falta: (c) => linhasLog.push({ c: 'falta', t: `✗ <b>${esc(c)}</b>: campo não encontrado nesta tela` }),
    };
  }

  async function acao(a, alvo) {
    if (ocupado) return;
    mensagem = '';
    if (a === 'abrir') aberto = true;
    else if (a === 'fechar') aberto = false;
    else if (a === 'login') {
      const r = await enviar({ acao: 'login', email: raiz.getElementById('email').value, senha: raiz.getElementById('senha').value });
      if (r.erro) mensagem = r.erro;
    } else if (a === 'sair') {
      await enviar({ acao: 'sair' });
      linhasLog = [];
    } else if (a === 'buscar') {
      const r = await enviar({ acao: 'buscar', numero: raiz.getElementById('numero').value });
      linhasLog = [];
      if (r.erro) mensagem = r.erro;
    } else if (a === 'limpar') {
      await enviar({ acao: 'limpar' });
      linhasLog = [];
    } else if (a === 'marcar' || a === 'desmarcar') {
      const r = await enviar({ acao: 'marcar', lancado: a === 'marcar' });
      if (r.erro) mensagem = r.erro;
    } else if (a === 'diag') {
      try {
        await navigator.clipboard.writeText(diagnostico());
        mensagem = 'Diagnóstico copiado. Cole num arquivo .txt e mande para quem configura a extensão.';
      } catch (e) {
        mensagem = 'Não consegui copiar: clique na página e tente de novo.';
      }
    } else if (a === 'copiar') {
      try {
        await navigator.clipboard.writeText(alvo);
        mensagem = `Código ${alvo} copiado.`;
      } catch (e) { /* sem permissão: ignora */ }
    } else if (['paciente', 'guia', 'exames'].includes(a)) {
      const st = await enviar({ acao: 'estado' });
      if (!st.pedido) return;
      ocupado = true;
      raiz.querySelectorAll('.btn').forEach((b) => (b.disabled = true));
      const log = novoLog();
      try {
        if (a === 'paciente') await preencherPaciente(st.pedido, log);
        else if (a === 'guia') await preencherGuia(st.pedido, log);
        else await incluirExames(st.pedido, log);
      } catch (e) {
        mensagem = 'Erro ao preencher: ' + (e && e.message ? e.message : e);
      }
      ocupado = false;
    }
    await desenhar();
  }

  raiz.addEventListener('click', (e) => {
    const cod = e.target.closest('[data-cod]');
    if (cod) return acao('copiar', cod.dataset.cod);
    const b = e.target.closest('[data-a]');
    if (b) acao(b.dataset.a);
  });

  // Abre sozinho quando já há um pedido em andamento (ex.: passou do paciente para a guia).
  enviar({ acao: 'estado' }).then((st) => {
    aberto = !!(st && st.pedido);
    desenhar();
  });

  // O LaborLIS troca de tela sem recarregar: redesenha para destacar o passo certo.
  let ultimoEndereco = location.pathname;
  setInterval(() => {
    if (location.pathname !== ultimoEndereco) {
      ultimoEndereco = location.pathname;
      if (aberto && !ocupado) desenhar();
    }
  }, 800);

  // Expõe as funções para os testes automáticos.
  window.__alchemypetLisTeste = { preencherPaciente, preencherGuia, incluirExames, diagnostico, campos };
})();
