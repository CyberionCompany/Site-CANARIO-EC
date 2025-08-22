import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- ELEMENTOS DO DOM ---
const loader = document.getElementById('loader');
const adminEmailSpan = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const addDocumentForm = document.getElementById('add-document-form');
const documentsTableBody = document.getElementById('documents-table-body');
const uploadBtn = document.getElementById('upload-btn');
const fileInfoDiv = document.getElementById('file-info');

// --- CONFIGURAÇÃO DO UPLOADCARE ---
const UPLOADCARE_PUBLIC_KEY = "42770f8d4d631daceb62"; // COLE SUA CHAVE AQUI
let uploadedFileInfo = null;

// --- AUTENTICAÇÃO E PROTEÇÃO DE PÁGINA ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        adminEmailSpan.textContent = `Bem-vindo, ${user.email}`;
        loader.style.display = 'none';
        fetchAndRenderDocuments();
    } else {
        window.location.href = 'index.html';
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// --- LÓGICA DO UPLOADCARE ---
uploadBtn.addEventListener('click', () => {
    const dialog = uploadcare.openDialog(null, {
        publicKey: UPLOADCARE_PUBLIC_KEY,
        tabs: 'file url', // Permite upload do computador ou via link
        locale: 'pt' // Traduz a interface para português
    });

    dialog.done(file => {
        // Quando o upload é concluído, o Uploadcare nos dá as informações do arquivo
        file.done(info => {
            console.log("Arquivo enviado com sucesso:", info);
            uploadedFileInfo = info; // Armazena as informações do arquivo
            fileInfoDiv.textContent = `Arquivo selecionado: ${info.name}`;
            fileInfoDiv.classList.add('success');
        });
    });
});

// --- LÓGICA DO FORMULÁRIO (FIRESTORE) ---
addDocumentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = addDocumentForm['doc-title'].value;
    const category = addDocumentForm['doc-category'].value;

    if (!uploadedFileInfo) {
        alert("Por favor, escolha e envie um arquivo primeiro.");
        return;
    }

    loader.style.display = 'flex';
    try {
        // Salva as informações do arquivo (fornecidas pelo Uploadcare) no Firestore
        await addDoc(collection(db, "documentos"), {
            title: title,
            category: category,
            fileURL: uploadedFileInfo.cdnUrl, // O link direto para o arquivo
            fileName: uploadedFileInfo.name,
            fileUUID: uploadedFileInfo.uuid, // ID único do arquivo no Uploadcare
            createdAt: new Date()
        });
        
        alert("Documento salvo com sucesso!");
        addDocumentForm.reset();
        fileInfoDiv.textContent = 'Nenhum arquivo selecionado.';
        fileInfoDiv.classList.remove('success');
        uploadedFileInfo = null;
        fetchAndRenderDocuments();

    } catch (error) {
        console.error("Erro ao salvar no Firestore:", error);
        alert("Ocorreu um erro ao salvar o documento.");
    } finally {
        loader.style.display = 'none';
    }
});

// --- RENDERIZAR E EXCLUIR DOCUMENTOS ---
const fetchAndRenderDocuments = async () => {
    documentsTableBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    try {
        const querySnapshot = await getDocs(collection(db, "documentos"));
        documentsTableBody.innerHTML = querySnapshot.empty ? '<tr><td colspan="3">Nenhum documento encontrado.</td></tr>' : '';
        
        querySnapshot.forEach((doc) => {
            const docData = doc.data();
            const row = documentsTableBody.insertRow();
            row.innerHTML = `
                <td><a href="${docData.fileURL}" target="_blank">${docData.title}</a></td>
                <td>${docData.category}</td>
                <td class="actions">
                    <button class="btn-icon btn-danger delete-btn" data-id="${doc.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    } catch (error) {
        console.error("Erro ao buscar documentos:", error);
        documentsTableBody.innerHTML = '<tr><td colspan="3">Erro ao carregar documentos.</td></tr>';
    }
};

documentsTableBody.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const docId = deleteBtn.dataset.id;
        if (confirm("Tem certeza que deseja excluir o registro deste documento?")) {
            loader.style.display = 'flex';
            try {
                // Apenas deleta o registro do Firestore
                await deleteDoc(doc(db, "documentos", docId));
                alert("Registro excluído com sucesso!");
                fetchAndRenderDocuments();
            } catch (error) {
                alert("Ocorreu um erro ao excluir o registro.");
            } finally {
                loader.style.display = 'none';
            }
        }
    }
});