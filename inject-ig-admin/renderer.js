const tbody = document.getElementById('user-table-body');

async function loadUsers() {
    const users = await window.universalAPI.getUsers();
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
        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
                    ${osSvg}
                </div>
            </td>
            <td>
                <div class="user-info">
                    <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}" class="avatar">
                    <div style="font-weight: 500;">${user.username}</div>
                </div>
            </td>
            <td><span class="hwid-tag">${user.hwid}</span></td>
            <td>${statusHtml}</td>
            <td>
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
            tr.innerHTML = `
                <td><span class="hwid-tag" style="user-select:all; cursor:copy;">${lic.key}</span></td>
                <td>
                    ${lic.hwid_vinculado ? `<span class="hwid-tag">${lic.hwid_vinculado}</span>` : '<span style="color:var(--text-2); font-style:italic;">Aguardando ativação...</span>'}
                </td>
                <td>
                    <span style="font-weight:600; font-size:12px;">${lic.duration_days ? lic.duration_days + ' Dias' : 'Permanente'}</span>
                </td>
                <td>${statusHtml}</td>
                <td>
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
        navigator.clipboard.writeText(res.key).catch(e => {});
        
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
    
    // Save
    doc.save(`NFe_ADM-IG_${lic.key}.pdf`);
}

// Loop de atualização das licenças e usuários a cada 5 segundos
setInterval(loadLicenses, 5000);
setInterval(loadUsers, 5000);
