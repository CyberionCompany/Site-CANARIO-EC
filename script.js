// --- CONFIGURAÇÃO DO FIREBASE (PARA FORMULÁRIO DE CONTATO) ---
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  databaseURL: "SUA_DATABASE_URL",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase apenas se a configuração estiver preenchida
if (firebaseConfig.apiKey !== "SUA_API_KEY") {
    firebase.initializeApp(firebaseConfig);
}

// --- LÓGICA PRINCIPAL DO SITE ---
document.addEventListener('DOMContentLoaded', () => {

    const menuToggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('overlay');
    const navLinks = document.querySelectorAll('.main-nav a');

    // --- LÓGICA DO MENU RESPONSIVO ---
    const closeMenu = () => {
        document.body.classList.remove('sidebar-open');
    };

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.classList.toggle('sidebar-open');
    });

    overlay.addEventListener('click', closeMenu);
    navLinks.forEach(link => link.addEventListener('click', closeMenu));

    // --- NAVEGAÇÃO SPA (SINGLE PAGE APPLICATION) ---
    const navItems = document.querySelectorAll('.main-nav li');
    const pages = document.querySelectorAll('.page');

    function showPage(hash) {
        pages.forEach(page => {
            page.classList.toggle('active', '#' + page.id === hash);
        });
        navItems.forEach(item => {
            const link = item.querySelector('a');
            if (link) {
                item.classList.toggle('active', link.hash === hash);
            }
        });
        // Leva o usuário ao topo da página ao navegar
        window.scrollTo(0, 0);
    }

    function handleHashChange() {
        // Se a URL não tiver hash, define como #home
        const hash = window.location.hash || '#home';
        showPage(hash);
    }

    window.addEventListener('hashchange', handleHashChange);
    
    // Adiciona evento de clique para todos os links que navegam entre seções
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const hash = this.getAttribute('href');
            
            // Apenas atualiza o hash se for diferente do atual para evitar recarregamento desnecessário
            if(window.location.hash !== hash) {
                window.location.hash = hash;
            }
        });
    });

    handleHashChange(); // Mostra a página correta ao carregar o site

    // --- ANIMAÇÃO AO ROLAR COM INTERSECTION OBSERVER ---
    const animatedElements = document.querySelectorAll('.animated-element');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Opcional: para de observar após a primeira vez para não repetir a animação
                // observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // A animação começa quando 10% do elemento está visível
    });

    animatedElements.forEach(el => {
        observer.observe(el);
    });
});

// --- FUNCIONALIDADE DE COPIAR CHAVE PIX ---
function copyPixKey(pixKey) {
    if (!navigator.clipboard) {
        alert("A cópia não é suportada neste navegador.");
        return;
    }
    navigator.clipboard.writeText(pixKey).then(() => {
        alert('Chave PIX copiada para a área de transferência!');
    }, (err) => {
        alert('Erro ao copiar a chave PIX.');
        console.error('Erro ao copiar: ', err);
    });
}

// --- FUNCIONALIDADE DO FORMULÁRIO DE CONTATO ---
const contactForm = document.getElementById('contactForm');
const formFeedback = document.getElementById('form-feedback');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (typeof firebase === 'undefined' || firebaseConfig.apiKey === "SUA_API_KEY") {
            formFeedback.textContent = 'Funcionalidade desativada. Configure o Firebase.';
            formFeedback.style.color = 'orange';
            return;
        }

        const name = contactForm.querySelector('#name').value;
        const email = contactForm.querySelector('#email').value;
        const message = contactForm.querySelector('#message').value;

        const database = firebase.database();
        database.ref('contatos/' + Date.now()).set({
            nome: name,
            email: email,
            mensagem: message,
            data: new Date().toISOString()
        }).then(() => {
            formFeedback.textContent = 'Mensagem enviada com sucesso!';
            formFeedback.style.color = 'green';
            contactForm.reset();
        }).catch((error) => {
            formFeedback.textContent = 'Ocorreu um erro. Tente novamente.';
            formFeedback.style.color = 'red';
            console.error('Erro ao salvar no Firebase: ', error);
        });
    });
}