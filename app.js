/**
 * app.js
 * Lógica principal para AppTareas.
 * Funcionalidad: Login (usando FETCH para autenticación), 
 * Creación de Tareas (enviando a Servidor/BD), 
 * Suscripción por Email (enviando a Servidor) y Auditoría (integrada con security.js).
 */

document.addEventListener('DOMContentLoaded', () => {
    // A. Referencias a elementos del DOM (Todos los archivos)
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password'); 
    const loginBtn = document.getElementById('btn-login');
    const loginMsg = document.getElementById('login-msg');

    // REFERENCIA AÑADIDA PARA EL BOTÓN DE CERRAR SESIÓN EN LA BARRA DE NAVEGACIÓN
    const logoutBtnNav = document.getElementById('btn-logout'); 
    
    const taskTitleInput = document.getElementById('task-title');
    const taskDescInput = document.getElementById('task-desc');
    const taskDueInput = document.getElementById('task-due');
    const createTaskForm = document.getElementById('create-task-form'); 
    const taskMsg = document.getElementById('task-msg');
    
    // Referencias para el formulario de Correo
    const emailInput = document.getElementById('email-input');
    const subscribeBtn = document.getElementById('btn-subscribe');
    const emailMsg = document.getElementById('email-msg');

    // Referencias para Auditoría
    const auditShowBtn = document.getElementById('btn-show-audit');
    const auditClearBtn = document.getElementById('btn-clear-audit');
    
    // Estado de sesión guardado en localStorage
    const SESSION_KEY = 'isAuthenticated';
    const USER_KEY = 'currentUsername'; 
    const MOCK_USERNAME = 'david'; 

    // Inicializa el estado del UI
    updateUI(localStorage.getItem(SESSION_KEY) === 'true');

    // Helper para capitalizar la primera letra (necesario para MongoDB)
    function capitalizeUsername(name) {
        if (!name) return '';
        // Convierte el nombre de usuario a 'David' (si es 'david')
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }

    // ----------------------------------------
    // B. LÓGICA DE INICIO DE SESIÓN / LOGOUT (USANDO FETCH)
    // ----------------------------------------
    
    async function handleLogin() {
        // Mecanismo de CERRAR SESIÓN si el botón ya tiene ese texto
        if (loginBtn.textContent === 'Cerrar Sesión') {
            handleLogout();
            return;
        }

        const username = usernameInput.value;
        const password = passwordInput.value; 
        
        if (!username || !password) {
            loginMsg.textContent = "Por favor, ingresa usuario y contraseña.";
            return;
        }

        loginMsg.textContent = "Iniciando sesión...";
        
        try {
            // Llama al endpoint de login en tu servidor
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Necesario para enviar la cookie de sesión
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // 🌟 FIX CRÍTICO PARA MONGODB: Capitalizamos el usuario al guardar 🌟
                const dbUsername = capitalizeUsername(username); 

                localStorage.setItem(SESSION_KEY, 'true');
                localStorage.setItem(USER_KEY, dbUsername); 

                if (window.security_audit_append) {
                    window.security_audit_append({ 
                        message: 'Login exitoso con Servidor', 
                        level: 'success', 
                        meta: { user: dbUsername } 
                    });
                }
                updateUI(true);
            } else {
                // Auditoría de fallo
                if (window.security_audit_append) {
                    window.security_audit_append({ 
                        message: 'Login fallido (Servidor)', 
                        level: 'warning', 
                        meta: { attemptUser: username, status: response.status } 
                    });
                }
                loginMsg.textContent = `Error (${response.status}): ${data.msg || 'Credenciales inválidas.'}`;
            }
        } catch (error) {
            console.error("Error al conectar con el servidor de Login:", error);
            loginMsg.textContent = "Error de conexión con el servidor.";
        }
    }

    async function handleLogout() {
        // Llama al endpoint del servidor para destruir la sesión
        try {
            await fetch('/logout', {
                method: 'GET',
                credentials: 'include'
            });
            // El servidor destruye la cookie, pero limpiamos el estado local de todas formas
        } catch (e) {
            console.warn("Fallo al contactar el endpoint de logout del servidor, limpiando localmente.");
        }
        
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(USER_KEY); 

        if (window.security_audit_append) {
            window.security_audit_append({ message: 'Sesión cerrada por usuario', level: 'info' });
        }
        updateUI(false);
    }
    
    if (loginBtn) {
        // Este event listener se mueve abajo, para ser asignado en updateUI
        // loginBtn.addEventListener('click', handleLogin);
    }
    
    // ----------------------------------------
    // C. LÓGICA DE CREACIÓN DE TAREAS (USANDO FETCH)
    // ----------------------------------------
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            taskMsg.textContent = "";

            if (localStorage.getItem(SESSION_KEY) !== 'true') {
                   taskMsg.textContent = "Error: Debes iniciar sesión para crear tareas.";
                   return;
            }

            const tareaData = {
                titulo: taskTitleInput.value,
                descripcion: taskDescInput.value,
                dueDate: taskDueInput.value
            };

            if (!tareaData.titulo) {
                taskMsg.textContent = "El título es obligatorio.";
                return;
            }

            taskMsg.textContent = "Creando tarea (enviando a Servidor)...";
            
            try {
                // Llama al endpoint de creación de tareas en tu servidor
                const response = await fetch('/tareas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(tareaData)
                });

                if (response.status === 401) {
                    taskMsg.textContent = "Error 401: Sesión expirada. Intente iniciar sesión de nuevo.";
                    updateUI(false);
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    taskMsg.textContent = `Tarea creada con éxito en la BD! ID: ${data.tarea._id || 'N/A'}`;
                    createTaskForm.reset();
                    
                    // AUDITORÍA
                    if (window.security_audit_append) {
                        window.security_audit_append({ 
                            message: 'Tarea General enviada a servidor', 
                            level: 'success',
                            details: { title: tareaData.titulo, serverId: data.tarea._id },
                            meta: { origin: 'index.html' }
                        });
                    }

                } else {
                    const errorData = await response.json();
                    taskMsg.textContent = `Error al crear tarea (${response.status}): ${errorData.msg || 'Error desconocido'}.`;
                    
                    // AUDITORÍA
                    if (window.security_audit_append) {
                        window.security_audit_append({ 
                            message: 'Fallo al crear tarea en servidor', 
                            level: 'error',
                            details: { status: response.status, error: errorData.msg },
                            meta: { origin: 'index.html' }
                        });
                    }
                }
            } catch (error) {
                console.error("Error en la solicitud de creación de tarea:", error);
                taskMsg.textContent = "Error de conexión con el servidor de tareas.";
            }
        });
    }
    
    // ----------------------------------------
    // D. LÓGICA DE SUSCRIPCIÓN DE EMAIL (USANDO FETCH)
    // ----------------------------------------
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', async () => {
            const email = emailInput.value;
            emailMsg.textContent = "";

            if (!email || !email.includes('@')) {
                emailMsg.textContent = "Por favor, introduce un correo electrónico válido.";
                return;
            }

            emailMsg.textContent = "Guardando correo (enviando a Servidor)...";
            
            try {
                // Llama al endpoint de suscripción en tu servidor
                const response = await fetch('/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (response.ok) {
                    emailMsg.textContent = `¡Correo de ${data.email} guardado con éxito en la BD!`;
                    emailInput.value = '';
                    
                    if (window.security_audit_append) {
                        window.security_audit_append({ 
                            message: 'Suscripción de email exitosa', 
                            level: 'success',
                            details: { email: email },
                            meta: { origin: 'email/indexE.html' }
                        });
                    }
                } else {
                    emailMsg.textContent = `Error al guardar correo (${response.status}): ${data.msg || 'Error desconocido'}`;
                    if (window.security_audit_append) {
                        window.security_audit_append({ 
                            message: 'Fallo en suscripción de email', 
                            level: 'error',
                            details: { email: email, status: response.status },
                            meta: { origin: 'email/indexE.html' }
                        });
                    }
                }
            } catch (error) {
                console.error("Error al enviar el correo:", error);
                emailMsg.textContent = "Error de conexión con el servidor de email.";
            }
        });
    }
    
    // ----------------------------------------
    // E. LÓGICA DE AUDITORÍA
    // ----------------------------------------
    
    if (auditShowBtn && window.security_audit_getAll) {
        auditShowBtn.addEventListener('click', () => {
            const logs = window.security_audit_getAll();
            
            console.groupCollapsed(`📚 REGISTRO DE AUDITORÍA (${logs.length} eventos)`);
            console.table(logs);
            console.groupEnd();

            alert(`Se han cargado ${logs.length} eventos de auditoría en la consola del navegador.`);
        });
    }

    if (auditClearBtn && window.security_audit_clear) {
        auditClearBtn.addEventListener('click', () => {
            
            const confirmClear = prompt("ADVERTENCIA: ¿Está seguro de que desea borrar todos los logs de auditoría? Escriba 'CONFIRMAR' para continuar.");

            if (confirmClear === 'CONFIRMAR') {
                window.security_audit_clear();
                alert('✅ Logs de auditoría limpiados correctamente.');
                console.clear();
            } else {
                alert('Operación cancelada.');
            }
        });
    }

    // ----------------------------------------
    // F. LÓGICA DE UI
    // ----------------------------------------
    function updateUI(isAuthenticated = false) {
        
        const taskCard = document.getElementById('task-card');
        const loginCard = document.getElementById('login-card');
        const taskCardStatus = document.getElementById('task-card-status');
        const currentUser = localStorage.getItem(USER_KEY) || MOCK_USERNAME; 
        
        // G. Referencia del nuevo botón de navegación
        const logoutBtnNav = document.getElementById('btn-logout'); 
        
        if (taskCard) { 
            
            if (isAuthenticated) {
                taskCard.style.opacity = 1;
                taskCard.style.pointerEvents = 'auto';
                taskCardStatus.textContent = `Sesión activa (${currentUser})`; 
                taskCardStatus.style.color = 'var(--color-accent)'; 
                
                if (loginCard) loginCard.style.display = 'none'; 
                loginBtn.textContent = 'Cerrar Sesión';
                loginMsg.textContent = `Sesión activa como ${currentUser}.`;
                
                // Muestra el botón de la barra de navegación
                if (logoutBtnNav) {
                    logoutBtnNav.style.display = 'inline-block';
                }

                // Reasignación de Event Listeners para el botón de login
                loginBtn.removeEventListener('click', handleLogin);
                loginBtn.addEventListener('click', handleLogout);

            } else {
                taskCard.style.opacity = 0.5;
                taskCard.style.pointerEvents = 'none';
                taskCardStatus.textContent = 'Requiere iniciar sesión';
                taskCardStatus.style.color = 'var(--color-text-secondary)';
                
                if (loginCard) loginCard.style.display = 'block'; 
                loginBtn.textContent = 'Iniciar sesión';
                loginMsg.textContent = "Inicie sesión para crear tareas.";
                
                // Oculta el botón de la barra de navegación
                if (logoutBtnNav) {
                    logoutBtnNav.style.display = 'none';
                }

                // Reasignación de Event Listeners para el botón de login
                loginBtn.removeEventListener('click', handleLogout);
                loginBtn.addEventListener('click', handleLogin);
            }
        }
    }
    
    // ----------------------------------------
    // G. LÓGICA DE EVENTO DEL BOTÓN DE NAVEGACIÓN
    // ----------------------------------------
    if (logoutBtnNav) {
        logoutBtnNav.addEventListener('click', (e) => {
            e.preventDefault(); // Previene la navegación
            handleLogout();     // Llama a la función de cierre de sesión existente
        });
    }

});