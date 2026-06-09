const tbody = document.getElementById('user-table-body');

async function loadUsers() {
    const users = await window.universalAPI.getUsers();
    window.currentUsers = users;
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const isTempBan = user.is_banned && user.ban_expires_at !== null;
        const isPermBan = user.is_banned && user.ban_expires_at === null;
        
        let statusHtml = '<span class="status active"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> ATIVO</span>';
        if (isPermBan) {
            statusHtml = '<span class="status banned"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> PERM-BANNED</span>';
        } else if (isTempBan) {
            const exp = new Date(user.ban_expires_at).toLocaleDateString();
            statusHtml = `<span class="status temp"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> SUSPENSO ATÉ ${exp}</span>`;
        }

        const osType = user.os_type || 'unknown';
        let osSvg = '<svg class="os-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'; // default
        
        if (osType === 'darwin') {
            osSvg = '<svg class="os-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 10.96C16.36 8.52 18.23 7.37 18.33 7.31C17.18 5.64 15.34 5.42 14.73 5.39C13.2 5.23 11.75 6.27 10.96 6.27C10.17 6.27 8.98 5.39 7.73 5.41C6.11 5.43 4.61 6.35 3.78 7.79C2.08 10.74 3.35 15.09 5.01 17.48C5.83 18.66 6.78 19.98 8.04 19.93C9.25 19.88 9.72 19.14 11.19 19.14C12.65 19.14 13.07 19.93 14.34 19.91C15.65 19.88 16.48 18.69 17.29 17.5C18.23 16.14 18.62 14.81 18.64 14.75C18.6 14.73 16.36 13.9 16.36 10.96ZM11.17 4.19C11.83 3.38 12.28 2.27 12.16 1.15C11.18 1.19 10.02 1.8 9.34 2.6C8.74 3.3 8.21 4.44 8.36 5.54C9.45 5.62 10.51 5.02 11.17 4.19Z"/></svg>';
        } else if (osType === 'win32') {
            osSvg = '<svg class="os-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2v20l-9.5-1.34v-17.3zM11.5 3.63l-9.5 1.34v14l9.5 1.34z"/></svg>';
        } else if (osType === 'linux') {
            osSvg = '<svg class="os-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C10.3 2 9 3.3 9 5c0 1.5 1.1 2.8 2.5 3V12c-2.5 0-4.5 2-4.5 4.5S9 21 11.5 21 16 19 16 16.5V8c1.4-.2 2.5-1.5 2.5-3 0-1.7-1.3-3-3-3zm-1 8h2v6.5c0 1.4-1.1 2.5-2.5 2.5S8 17.9 8 16.5c0-1.2.9-2.2 2-2.4V10zm2.5-6C14.3 4 15 4.7 15 5.5S14.3 7 13.5 7 12 6.3 12 5.5 12.7 4 13.5 4zm-3 0C11.3 4 12 4.7 12 5.5S11.3 7 10.5 7 9 6.3 9 5.5 9.7 4 10.5 4z"/></svg>';
        }

        const tr = document.createElement('tr');
        // Adiciona evento para abrir o Bottom Sheet no mobile
        tr.setAttribute('onclick', `openUserSheet('${user.hwid}')`);
        tr.innerHTML = `
            <td data-label="OS">
                <div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
                    ${osSvg}
                </div>
            </td>
            <td data-label="Usuário">
                <div class="user-info">
                    <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}" class="avatar">
                    <div style="font-weight: 500;">${user.username}</div>
                </div>
            </td>
            <td data-label="Hardware ID"><span class="hwid-tag">${user.hwid}</span></td>
            <td data-label="Status">${statusHtml}</td>
            <td data-label="Ações">
                <div class="actions">
                    <button class="btn-perm" onclick="banUser('${user.hwid}', 'permanent')">Ban Permanente</button>
                    <button class="btn-temp" onclick="banUser('${user.hwid}', '30days')">Ban 30 Dias</button>
                    <button class="btn-unban" onclick="banUser('${user.hwid}', 'unban')">Unban</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function banUser(hwid, type) {
    const res = await window.universalAPI.banUser(hwid, type);
    if (res.success) {
        loadUsers();
    } else {
        alert("Erro ao executar ação: " + res.message);
    }
}

// Inicializa a lista e atualiza automaticamente a cada 5 segundos
loadUsers();
setInterval(loadUsers, 5000);

// ── Licenças DRM ──
const licenseTbody = document.getElementById('license-table-body');

async function loadLicenses() {
    if (!document.getElementById('view-licenses').classList.contains('active')) return;
    
    try {
        const licenses = await window.universalAPI.getLicenses();
        if (!licenseTbody) return;
        window.currentLicenses = licenses;
        licenseTbody.innerHTML = '';
        
        licenses.forEach(lic => {
            let statusHtml = '';
            
            if (!lic.is_active) {
                statusHtml = '<span class="status banned">Suspensa</span>';
            } else if (!lic.hwid_vinculado) {
                statusHtml = '<span class="status active" style="color:var(--text-1); background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2);">Livre</span>';
            } else {
                let isExpired = false;
                if (lic.expires_at) {
                    const exp = new Date(lic.expires_at);
                    if (new Date() > exp) isExpired = true;
                }
                
                if (isExpired) {
                    statusHtml = '<span class="status banned">Expirada</span>';
                } else {
                    statusHtml = '<span class="status active">Em Uso</span>';
                    if (lic.expires_at) {
                        statusHtml += `<br><small style="color:var(--text-2); font-size:10px;">Até ${new Date(lic.expires_at).toLocaleDateString()}</small>`;
                    }
                }
            }

            const tr = document.createElement('tr');
            // Adiciona evento para abrir o Bottom Sheet no mobile
            tr.setAttribute('onclick', `openLicenseSheet(${lic.id})`);
            tr.innerHTML = `
                <td data-label="Chave">
                    <div style="display:inline-flex; align-items:center; gap:8px;">
                        <span class="hwid-tag" style="user-select:all;">${lic.key}</span>
                        <button class="copy-btn" onclick="copyKey('${lic.key}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Copiar
                        </button>
                    </div>
                </td>
                <td data-label="Hardware Vinculado">
                    ${lic.hwid_vinculado ? `<span class="hwid-tag">${lic.hwid_vinculado}</span>` : '<span style="color:var(--text-2); font-style:italic;">Aguardando ativação...</span>'}
                </td>
                <td data-label="Validade">
                    <span style="font-weight:600; font-size:12px;">${lic.duration_days ? lic.duration_days + ' Dias' : 'Permanente'}</span>
                </td>
                <td data-label="Status">${statusHtml}</td>
                <td data-label="Ações">
                    <div class="actions">
                        <button class="btn-primary" style="background: rgba(10, 132, 255, 0.2);" onclick="generateInvoicePDF(${lic.id})">Baixar NFe</button>
                        <button class="${lic.is_active ? 'btn-temp' : 'btn-unban'}" onclick="revokeLicense(${lic.id})">${lic.is_active ? 'Suspender' : 'Restaurar'}</button>
                        <button class="btn-perm" onclick="deleteLicense(${lic.id})">Excluir</button>
                    </div>
                </td>
            `;
            licenseTbody.appendChild(tr);
        });
    } catch(e) {
        console.error(e);
    }
}

async function generateLicense(days) {
    const res = await window.universalAPI.generateLicense(days);
    if (res.success) {
        await loadLicenses();
        
        // Auto download the PDF for the newly generated license
        setTimeout(() => {
            if (window.currentLicenses) {
                const newLic = window.currentLicenses.find(l => l.key === res.key);
                if (newLic) window.generateInvoicePDF(newLic.id);
            }
        }, 500);
    } else {
        alert("Erro ao gerar licença: " + res.message);
    }
}

window.copyKey = function(key) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(key).then(() => {
            alert("Chave copiada: " + key);
        }).catch(err => {
            alert("Erro ao copiar: " + err);
        });
    } else {
        alert("Clipboard não suportado");
    }
}

async function revokeLicense(id) {
    const res = await window.universalAPI.revokeLicense(id);
    if (res.success) {
        loadLicenses();
    } else {
        alert("Erro: " + res.message);
    }
}

async function deleteLicense(id) {
    if(!confirm("Tem certeza que deseja apagar esta chave permanentemente? O cliente perderá acesso na hora.")) return;
    const res = await window.universalAPI.deleteLicense(id);
    if (res.success) {
        loadLicenses();
    } else {
        alert("Erro: " + res.message);
    }
}

window.generateInvoicePDF = function(id) {
    if (!window.jspdf) {
        alert("Aguarde a biblioteca de PDF carregar...");
        return;
    }
    const { jsPDF } = window.jspdf;
    const lic = window.currentLicenses?.find(l => l.id === id);
    if (!lic) return;

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Dark Mode / OLED styling for the PDF
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 0, 210, 297, 'F');

    // Header
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("NOTA FISCAL / INVOICE", 105, 30, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("EMITIDO POR: ADM - IG SECURITY INC.", 105, 40, { align: 'center' });
    
    // Line separator
    doc.setDrawColor(50, 50, 50);
    doc.line(20, 50, 190, 50);

    // Document Data
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    
    const emissionDate = new Date().toLocaleString('pt-BR');
    const licenseType = lic.duration_days ? `${lic.duration_days} Dias` : 'Permanente (Vitalícia)';
    const statusStr = lic.is_active ? "Ativa" : "Suspensa/Cancelada";

    const startY = 65;
    const lh = 10;
    
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DA LICENÇA", 20, startY);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Data de Emissão: ${emissionDate}`, 20, startY + lh);
    doc.text(`Produto: Licença de Acesso Corporativo - ADM IG Security`, 20, startY + lh * 2);
    doc.text(`Chave Serial: ${lic.key}`, 20, startY + lh * 3);
    doc.text(`Tipo de Assinatura: ${licenseType}`, 20, startY + lh * 4);
    doc.text(`Status Atual: ${statusStr}`, 20, startY + lh * 5);

    if (lic.hwid_vinculado) {
        doc.text(`Hardware Vinculado: ${lic.hwid_vinculado}`, 20, startY + lh * 6);
    } else {
        doc.text(`Hardware Vinculado: Nenhum (Chave Virgem)`, 20, startY + lh * 6);
    }

    // Line separator
    doc.line(20, startY + lh * 8, 190, startY + lh * 8);

    // Authentication Code
    doc.setFont("helvetica", "bold");
    doc.text("AUTENTICAÇÃO DIGITAL", 20, startY + lh * 9.5);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    const hashData = btoa(lic.key + "-" + emissionDate).replace(/=/g, '');
    const hash = hashData.substring(0, 32).toUpperCase();
    doc.text(`Hash de Autenticação: ${hash}`, 20, startY + lh * 10.5);
    doc.text("Este documento serve como recibo oficial de licenciamento de software.", 20, startY + lh * 11.5);
    
    // Save or Share Mobile
    const fileName = `NFe_ADM-IG_${lic.key}.pdf`;
    
    try {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                title: fileName,
                files: [file]
            }).catch(e => {
                doc.save(fileName);
            });
        } else {
            doc.save(fileName);
        }
    } catch (e) {
        doc.save(fileName);
    }
}

// ── Pagamentos Pendentes ──
const paymentTbody = document.getElementById('payment-table-body');

window.loadPendingPayments = async function() {
    if (!document.getElementById('view-payments').classList.contains('active')) return;
    
    try {
        const payments = await window.universalAPI.getPendingPayments();
        if (!paymentTbody) return;
        paymentTbody.innerHTML = '';
        
        payments.forEach(pay => {
            const isApproved = pay.status === 'approved';
            let statusHtml = isApproved 
                ? '<span class="status active">Aprovado (Liberado)</span>'
                : '<span class="status temp">Pendente</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="ID"><span style="font-size:12px; color:var(--text-2);">#${pay.id}</span></td>
                <td data-label="Nick"><span style="font-weight:600;">${pay.nick}</span></td>
                <td data-label="Plano">${pay.plan} Dias</td>
                <td data-label="Data">${new Date(pay.created_at).toLocaleString()}</td>
                <td data-label="Ações">
                    <div class="actions">
                        ${!isApproved 
                            ? `<button class="btn-primary" style="background:var(--green); color:white; box-shadow: 0 2px 10px rgba(52,199,89,0.3);" onclick="approvePayment(${pay.id})">Confirmar Pagamento</button>` 
                            : statusHtml
                        }
                    </div>
                </td>
            `;
            paymentTbody.appendChild(tr);
        });
    } catch(e) {
        console.error(e);
    }
}

window.approvePayment = async function(id) {
    if(!confirm("Tem certeza que o dinheiro já caiu na sua conta? Isso irá liberar o acesso imediatamente na máquina do cliente.")) return;
    
    const res = await window.universalAPI.approvePayment(id);
    if (res.success) {
        loadPendingPayments();
        alert("Pagamento aprovado com sucesso! A chave foi gerada e o cliente já tem acesso.");
    } else {
        alert("Erro ao aprovar: " + res.message);
    }
}

// ==========================================
// NOTIFICAÇÕES NATIVAS (CAPACITOR)
// ==========================================
let lastPendingCount = 0;

async function checkNotificationsPermission() {
    if (window.Capacitor && window.Capacitor.Plugins.LocalNotifications) {
        const { display } = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
        if (display !== 'granted') {
            console.log("Permissão para notificações não foi concedida.");
        }
    }
}

// Requisita a permissão logo que o app inicializa
setTimeout(checkNotificationsPermission, 2000);

window.pollPaymentsForNotifications = async function() {
    try {
        const payments = await window.universalAPI.getPendingPayments();
        const pendingCount = payments.filter(p => p.status !== 'approved').length;
        
        if (pendingCount > lastPendingCount) {
             if (window.Capacitor && window.Capacitor.Plugins.LocalNotifications) {
                 await window.Capacitor.Plugins.LocalNotifications.schedule({
                     notifications: [
                         {
                             title: "💰 Novo Pagamento Detectado!",
                             body: `Há ${pendingCount} pagamento(s) aguardando sua aprovação na fila.`,
                             id: new Date().getTime(),
                             schedule: { at: new Date(Date.now() + 1000) },
                             sound: null,
                             attachments: null,
                             actionTypeId: "",
                             extra: null
                         }
                     ]
                 });
             }
        }
        lastPendingCount = pendingCount;
    } catch(e) {
        console.error("Erro no polling de notificações:", e);
    }
}
// ==========================================
// BACKGROUND FETCH MODO (CAPACITOR APP)
// ==========================================
if (window.Capacitor && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('appStateChange', async (state) => {
        if (!state.isActive) {
            console.log("App em background: Iniciando tarefa nativa.");
            try {
                const taskId = await window.Capacitor.Plugins.App.requestBackgroundTask({
                    reason: 'Checar pagamentos pendentes',
                }).then(id => id).catch(() => null);

                if (taskId) {
                    // Força um polling acelerado enquanto a Apple permitir (máximo 30s)
                    let bgInterval = setInterval(async () => {
                        if (typeof window.pollPaymentsForNotifications === 'function') {
                            await window.pollPaymentsForNotifications();
                        }
                    }, 4000);

                    // A Apple mata tarefas de background depois de 25-30 segundos.
                    // Precisamos encerrar graciosamente antes de tomar kill do sistema.
                    setTimeout(() => {
                        clearInterval(bgInterval);
                        window.Capacitor.Plugins.App.finish({ taskId });
                        console.log("Tarefa nativa de background encerrada.");
                    }, 25000);
                }
            } catch (e) {
                console.error("Erro na tarefa de background:", e);
            }
        }
    });
}
// Loop de atualização das licenças, usuários e pagamentos a cada 5 segundos
setInterval(loadLicenses, 5000);
setInterval(loadUsers, 5000);
setInterval(() => {
    if (typeof loadPendingPayments === 'function') loadPendingPayments();
    if (typeof pollPaymentsForNotifications === 'function') pollPaymentsForNotifications();
}, 5000);

// ==========================================
// LÓGICA DO BOTTOM SHEET (MOBILE)
// ==========================================
window.closeSheet = function() {
    document.getElementById('sheet-overlay').classList.remove('active');
    document.getElementById('bottom-sheet').classList.remove('active');
}

window.openUserSheet = function(hwid) {
    if (window.innerWidth > 700) return; // Apenas no celular
    const user = window.currentUsers?.find(u => u.hwid === hwid);
    if (!user) return;
    
    const content = document.getElementById('sheet-content');
    
    // Calcula o SVG do OS nativo
    const osType = user.os_type || 'unknown';
    let osSvg = '<svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    if (osType === 'darwin') {
        osSvg = '<svg style="width:16px; height:16px; color:#fff;" viewBox="0 0 24 24" fill="currentColor"><path d="M16.36 10.96C16.36 8.52 18.23 7.37 18.33 7.31C17.18 5.64 15.34 5.42 14.73 5.39C13.2 5.23 11.75 6.27 10.96 6.27C10.17 6.27 8.98 5.39 7.73 5.41C6.11 5.43 4.61 6.35 3.78 7.79C2.08 10.74 3.35 15.09 5.01 17.48C5.83 18.66 6.78 19.98 8.04 19.93C9.25 19.88 9.72 19.14 11.19 19.14C12.65 19.14 13.07 19.93 14.34 19.91C15.65 19.88 16.48 18.69 17.29 17.5C18.23 16.14 18.62 14.81 18.64 14.75C18.6 14.73 16.36 13.9 16.36 10.96ZM11.17 4.19C11.83 3.38 12.28 2.27 12.16 1.15C11.18 1.19 10.02 1.8 9.34 2.6C8.74 3.3 8.21 4.44 8.36 5.54C9.45 5.62 10.51 5.02 11.17 4.19Z"/></svg>';
    } else if (osType === 'win32') {
        osSvg = '<svg style="width:16px; height:16px; color:#00a4ef;" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2v20l-9.5-1.34v-17.3zM11.5 3.63l-9.5 1.34v14l9.5 1.34z"/></svg>';
    } else if (osType === 'linux') {
        osSvg = '<svg style="width:16px; height:16px; color:#f5a900;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C10.3 2 9 3.3 9 5c0 1.5 1.1 2.8 2.5 3V12c-2.5 0-4.5 2-4.5 4.5S9 21 11.5 21 16 19 16 16.5V8c1.4-.2 2.5-1.5 2.5-3 0-1.7-1.3-3-3-3zm-1 8h2v6.5c0 1.4-1.1 2.5-2.5 2.5S8 17.9 8 16.5c0-1.2.9-2.2 2-2.4V10zm2.5-6C14.3 4 15 4.7 15 5.5S14.3 7 13.5 7 12 6.3 12 5.5 12.7 4 13.5 4zm-3 0C11.3 4 12 4.7 12 5.5S11.3 7 10.5 7 9 6.3 9 5.5 9.7 4 10.5 4z"/></svg>';
    }

    content.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:16px;">
            <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}" style="width:50px; height:50px; border-radius:50%; background:rgba(255,255,255,0.1);">
            <div>
                <h3 style="font-size:18px; margin-bottom:4px;">${user.username}</h3>
                <span style="font-size:12px; color:var(--text-2);">${user.hwid}</span>
            </div>
        </div>
        <div>
            <div style="font-size:12px; color:var(--text-2); margin-bottom:4px;">Sistema Operacional Detectado</div>
            <div style="font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; text-transform:capitalize;">
                ${osSvg} ${user.os_type || 'Desconhecido'}
            </div>
        </div>
        <div class="actions">
            <button class="btn-perm" onclick="banUser('${user.hwid}', 'permanent'); closeSheet();">Banir Permanentemente</button>
            <button class="btn-temp" onclick="banUser('${user.hwid}', '30days'); closeSheet();">Suspender 30 Dias</button>
            <button class="btn-unban" onclick="banUser('${user.hwid}', 'unban'); closeSheet();">Restaurar Acesso</button>
        </div>
    `;
    document.getElementById('sheet-overlay').classList.add('active');
    document.getElementById('bottom-sheet').classList.add('active');
}

window.openLicenseSheet = function(id) {
    if (window.innerWidth > 700) return; // Apenas no celular
    const lic = window.currentLicenses?.find(l => l.id === id);
    if (!lic) return;
    
    const content = document.getElementById('sheet-content');
    const statusText = lic.is_active ? (lic.hwid_vinculado ? 'Em Uso' : 'Livre') : 'Suspensa/Expirada';
    
    content.innerHTML = `
        <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:16px;">
            <h3 style="font-size:18px; margin-bottom:8px;">Detalhes da Licença</h3>
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                <span style="font-family:monospace; font-size:14px;">${lic.key}</span>
                <button class="copy-btn" onclick="copyKey('${lic.key}')" style="margin:0;">Copiar</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div>
                <div style="font-size:12px; color:var(--text-2); margin-bottom:4px;">Status</div>
                <div style="font-size:14px; font-weight:600;">${statusText}</div>
            </div>
            <div>
                <div style="font-size:12px; color:var(--text-2); margin-bottom:4px;">Validade</div>
                <div style="font-size:14px; font-weight:600;">${lic.duration_days ? lic.duration_days + ' Dias' : 'Permanente'}</div>
            </div>
        </div>
        <div>
            <div style="font-size:12px; color:var(--text-2); margin-bottom:4px;">Hardware Vinculado</div>
            <div style="font-size:14px;">${lic.hwid_vinculado || '<span style="opacity:0.5;">Nenhum hardware ativado ainda.</span>'}</div>
        </div>
        <div class="actions">
            <button class="btn-primary" style="background: rgba(10, 132, 255, 0.2);" onclick="generateInvoicePDF(${lic.id})">Baixar NFe (PDF)</button>
            <button class="${lic.is_active ? 'btn-temp' : 'btn-unban'}" onclick="revokeLicense(${lic.id}); closeSheet();">${lic.is_active ? 'Suspender Licença' : 'Restaurar Licença'}</button>
            <button class="btn-perm" onclick="deleteLicense(${lic.id}); closeSheet();">Excluir Chave</button>
        </div>
    `;
    document.getElementById('sheet-overlay').classList.add('active');
    document.getElementById('bottom-sheet').classList.add('active');
}


// ── Support Tickets (Realtime Chat Admin) ──
let adminActiveHwid = null;

async function loadAdminChats() {
    if (!document.getElementById('view-tickets').classList.contains('active')) return;
    
    try {
        const res = await window.adminAPI.getAllActiveChats();
        if (!res.success) return;
        
        const hwidsContainer = document.getElementById('suporte-admin-hwids');
        if (!hwidsContainer) return;
        
        hwidsContainer.innerHTML = '';
        res.chats.forEach(chat => {
            const div = document.createElement('div');
            div.style.cssText = `padding: 12px 15px; cursor: pointer; border-bottom: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 4px; transition: background 0.2s;`;
            if (adminActiveHwid === chat.hwid) div.style.background = 'rgba(10, 132, 255, 0.15)';
            
            div.onmouseover = () => { if(adminActiveHwid !== chat.hwid) div.style.background = 'rgba(255,255,255,0.05)' };
            div.onmouseout = () => { if(adminActiveHwid !== chat.hwid) div.style.background = 'transparent' };
            
            div.onclick = () => selectAdminChat(chat.hwid, div);
            
            const hwidShort = chat.hwid.substring(0, 8) + '...';
            const timeStr = new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; font-size: 13px; color: #fff;">${hwidShort}</span>
                    <span style="font-size: 10px; color: var(--text-3);">${timeStr}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${chat.lastIsAdmin ? 'Você: ' : ''}${chat.lastMessage}
                </div>
            `;
            hwidsContainer.appendChild(div);
        });
    } catch(e) {
        console.error("Erro ao carregar chats:", e);
    }
}

async function selectAdminChat(hwid, element) {
    adminActiveHwid = hwid;
    
    // UI Update for sidebar
    const container = document.getElementById('suporte-admin-hwids');
    Array.from(container.children).forEach(child => child.style.background = 'transparent');
    if (element) element.style.background = 'rgba(10, 132, 255, 0.15)';
    
    // UI Update for Chat Area
    document.getElementById('suporte-admin-header').innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-2); cursor:pointer;" onclick="adminActiveHwid=null; loadAdminChats(); document.getElementById('suporte-admin-chat-area').style.display='none';"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span style="font-family: monospace;">${hwid}</span>
        </div>
        <span style="font-size: 11px; color: var(--green);">Online</span>
    `;
    document.getElementById('suporte-admin-chat-area').style.display = 'flex';
    
    document.getElementById('suporte-admin-input').disabled = false;
    document.getElementById('suporte-admin-input').style.opacity = '1';
    document.getElementById('suporte-admin-submit-btn').disabled = false;
    document.getElementById('suporte-admin-submit-btn').style.opacity = '1';
    
    const messagesContainer = document.getElementById('suporte-admin-messages');
    messagesContainer.innerHTML = '<div style="text-align: center; color: var(--text-3); font-size: 12px; margin: auto;">Carregando mensagens...</div>';
    
    const res = await window.adminAPI.getSupportMessages(hwid);
    messagesContainer.innerHTML = '';
    
    if (res.success && res.messages.length > 0) {
        res.messages.forEach(msg => {
            renderMessageBubble(msg, messagesContainer, msg.is_admin);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        messagesContainer.innerHTML = '<div style="text-align: center; color: var(--text-3); font-size: 12px; margin: auto;">Nenhuma mensagem encontrada.</div>';
    }
}

function renderMessageBubble(msg, container, isMine) {
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.style.cssText = `display: flex; flex-direction: column; max-width: 80%; ${isMine ? 'align-self: flex-end;' : 'align-self: flex-start;'}`;
    
    const bubble = document.createElement('div');
    bubble.style.cssText = `
        padding: 12px 16px; 
        border-radius: 16px; 
        font-size: 13px; 
        line-height: 1.4; 
        color: #fff;
        ${isMine 
            ? 'background: var(--blue); border-bottom-right-radius: 4px;' 
            : 'background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.05); border-bottom-left-radius: 4px;'}
    `;
    bubble.innerText = msg.message;
    
    const time = document.createElement('div');
    const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    time.style.cssText = `font-size: 10px; color: var(--text-3); margin-top: 4px; ${isMine ? 'text-align: right;' : 'text-align: left;'}`;
    time.innerText = timeStr;
    
    bubbleWrapper.appendChild(bubble);
    bubbleWrapper.appendChild(time);
    container.appendChild(bubbleWrapper);
}

function setupRealtimeSupportAdmin() {
    if (window.adminAPI && window.adminAPI.onRealtimeSupportMessage) {
        window.adminAPI.onRealtimeSupportMessage((msg) => {
            if (document.getElementById('view-tickets').classList.contains('active')) {
                loadAdminChats(); // atualiza a sidebar
                if (adminActiveHwid === msg.hwid) {
                    const container = document.getElementById('suporte-admin-messages');
                    renderMessageBubble(msg, container, msg.is_admin);
                    container.scrollTop = container.scrollHeight;
                }
            }
        });
    }
}

// ── Overrides & Listeners ──
window.loadTickets = loadAdminChats;

const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);
    if (tabId === 'tickets') loadAdminChats();
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSend = document.getElementById('btn-send-admin-msg');
    const input = document.getElementById('admin-message-input');
    
    if (btnSend && input) {
        btnSend.addEventListener('click', async () => {
            const msg = input.value.trim();
            if (!msg) return;
            
            btnSend.disabled = true;
            btnSend.textContent = 'Enviando...';
            
            const res = await window.universalAPI.postAdminMessage(msg);
            if (res && res.success) {
                input.value = '';
                btnSend.textContent = 'Enviado com Sucesso!';
                btnSend.style.background = '#25D366';
            } else {
                alert('Erro ao enviar aviso: ' + res.message);
                btnSend.textContent = 'Erro ao enviar';
                btnSend.style.background = '#ff3b30';
            }
            
            setTimeout(() => {
                btnSend.disabled = false;
                btnSend.textContent = 'Enviar Aviso Global';
                btnSend.style.background = '#0a84ff';
            }, 3000);
        });
    }
    
    const adminChatForm = document.getElementById('suporte-admin-form');
    if (adminChatForm) {
        adminChatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!adminActiveHwid) return;
            
            const input = document.getElementById('suporte-admin-input');
            const text = input.value.trim();
            if (!text) return;
            
            input.value = '';
            input.focus();
            
            // Render optimistically
            const msgObj = { message: text, created_at: new Date().toISOString(), is_admin: true, hwid: adminActiveHwid };
            const container = document.getElementById('suporte-admin-messages');
            
            // Remove empty state if present
            if (container.innerHTML.includes('Nenhuma mensagem')) container.innerHTML = '';
            
            renderMessageBubble(msgObj, container, true);
            container.scrollTop = container.scrollHeight;
            
            await window.adminAPI.submitSupportTicket(adminActiveHwid, text, true);
        });
    }
    
    setupRealtimeSupportAdmin();
});
