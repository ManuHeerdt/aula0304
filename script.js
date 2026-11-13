const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');
const nova = document.getElementById('nova');
const listaConversas = document.getElementById('lista-conversas');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const abrirSidebar = document.getElementById('abrir-sidebar');

// Recupera a lista de conversas salvas no navegador: [{ id, titulo }]
let historicoLocal = JSON.parse(localStorage.getItem('lista_conversas') || '[]');
let conversa = localStorage.getItem('conversa');

if (!conversa) {
  conversa = crypto.randomUUID();
  localStorage.setItem('conversa', conversa);
}

function salvarListaLocal() {
  localStorage.setItem('lista_conversas', JSON.stringify(historicoLocal));
}

// Registra a conversa na barra lateral usando a primeira mensagem como título
function registrarConversaNaBarra(id, primeiraMensagem) {
  const existente = historicoLocal.find(c => c.id === id);
  if (!existente) {
    const titulo = primeiraMensagem.length > 32
      ? primeiraMensagem.slice(0, 32) + '...'
      : primeiraMensagem;
    historicoLocal.unshift({ id: id, titulo: titulo });
    salvarListaLocal();
    desenharBarraLateral();
  }
}

// Desenha os itens clicáveis na barra lateral
function desenharBarraLateral() {
  listaConversas.innerHTML = '';

  for (const item of historicoLocal) {
    const div = document.createElement('div');
    div.className = 'item-conversa' + (item.id === conversa ? ' ativa' : '');

    const spanTitulo = document.createElement('span');
    spanTitulo.className = 'item-titulo';
    spanTitulo.textContent = item.titulo;

    const btnApagar = document.createElement('button');
    btnApagar.className = 'btn-apagar';
    btnApagar.type = 'button';
    btnApagar.textContent = '✕';
    btnApagar.title = 'Remover da lista';
    btnApagar.addEventListener('click', (e) => {
      e.stopPropagation();
      historicoLocal = historicoLocal.filter(c => c.id !== item.id);
      salvarListaLocal();
      if (item.id === conversa) {
        nova.click();
      } else {
        desenharBarraLateral();
      }
    });

    div.appendChild(spanTitulo);
    div.appendChild(btnApagar);

    // Ao clicar em uma conversa anterior, carrega o histórico dela do MySQL
    div.addEventListener('click', () => {
      if (item.id === conversa) return;
      conversa = item.id;
      localStorage.setItem('conversa', conversa);
      desenharBarraLateral();
      carregarHistorico();
    });

    listaConversas.appendChild(div);
  }
}

function mostrar(classe, texto) {
  const div = document.createElement('div');
  div.className = classe;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// Busca no servidor (MySQL) as mensagens do ID selecionado
async function carregarHistorico() {
  chat.textContent = '';
  try {
    const resposta = await fetch('/historico/' + conversa);
    const mensagens = await resposta.json();
    if (!resposta.ok) throw new Error(mensagens.erro);

    for (const m of mensagens) {
      mostrar('msg ' + m.role, m.content);
    }

    // Se essa conversa já existia no banco mas não estava na barra, adiciona
    if (mensagens.length > 0) {
      const primeiraUser = mensagens.find(m => m.role === 'user');
      if (primeiraUser) {
        registrarConversaNaBarra(conversa, primeiraUser.content);
      }
    }
  } catch (erro) {
    mostrar('msg assistant', 'Erro ao carregar o histórico: ' + erro.message);
  }
}

// Botão "Nova conversa"
nova.addEventListener('click', () => {
  conversa = crypto.randomUUID();
  localStorage.setItem('conversa', conversa);
  chat.textContent = '';
  desenharBarraLateral();
  pergunta.focus();
});

// Abrir e fechar a barra lateral
toggleSidebar.addEventListener('click', () => sidebar.classList.add('fechada'));
abrirSidebar.addEventListener('click', () => sidebar.classList.remove('fechada'));

// Envio de mensagem
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = pergunta.value.trim();
  if (!texto) return;

  registrarConversaNaBarra(conversa, texto);
  mostrar('msg user', texto);
  pergunta.value = '';
  enviar.disabled = true;
  const balao = mostrar('msg assistant', 'Pensando...');

  try {
    const resposta = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa: conversa, texto: texto })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);

    balao.textContent = dados.resposta;
    if (dados.ferramentas.length > 0) {
      mostrar('ferramentas', 'Consultou: ' + dados.ferramentas.join(', '));
    }
  } catch (erro) {
    balao.textContent = 'Erro: ' + erro.message;
  }
  enviar.disabled = false;
  pergunta.focus();
});

// Inicializa a barra lateral e carrega a conversa atual ao abrir a página
desenharBarraLateral();
carregarHistorico();