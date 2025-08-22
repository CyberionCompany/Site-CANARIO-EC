// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  databaseURL: "SUA_DATABASE_URL",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

if (firebaseConfig.apiKey !== "SUA_API_KEY") {
    firebase.initializeApp(firebaseConfig);
}

// --- LÓGICA PRINCIPAL DO SITE ---
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DO MENU RESPONSIVO ---
    const menuToggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('overlay');
    const navLinks = document.querySelectorAll('.main-nav a');

    // Função para fechar o menu
    const closeMenu = () => {
        document.body.classList.remove('sidebar-open');
    };

    // Abre/fecha o menu ao clicar no botão
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que o clique feche o menu imediatamente
        document.body.classList.toggle('sidebar-open');
    });

    // Fecha o menu ao clicar no overlay
    overlay.addEventListener('click', closeMenu);

    // Fecha o menu ao clicar em um link da navegação
    navLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // --- NAVEGAÇÃO SPA (SINGLE PAGE APPLICATION) ---
    const navItems = document.querySelectorAll('.main-nav li');
    const pages = document.querySelectorAll('.page');

    function showPage(hash) {
        pages.forEach(page => {
            page.classList.toggle('active', '#' + page.id === hash);
        });
        navItems.forEach(item => {
            item.classList.toggle('active', item.querySelector('a').hash === hash);
        });
    }

    function handleHashChange() {
        const hash = window.location.hash || '#home';
        showPage(hash);
    }

    window.addEventListener('hashchange', handleHashChange);
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // A prevenção do default já estava aqui, mas é importante para o SPA
            e.preventDefault(); 
            window.location.hash = link.hash;
        });
    });

    // Mostra a página inicial ou a página na URL
    handleHashChange();

    // --- ANIMAÇÃO AO ROLAR COM INTERSECTION OBSERVER ---
    const animatedElements = document.querySelectorAll('.animated-element');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1 // Ativa quando 10% do elemento está visível
    });

    animatedElements.forEach(el => {
        observer.observe(el);
    });
});

// --- FUNCIONALIDADE DE COPIAR CHAVE PIX ---
function copyPixKey(pixKey) {
    navigator.clipboard.writeText(pixKey).then(() => {
        alert('Chave PIX copiada!');
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
            formFeedback.textContent = 'Ocorreu um erro ao enviar. Tente novamente.';
            formFeedback.style.color = 'red';
            console.error('Erro ao salvar no Firebase: ', error);
        });
    });
}