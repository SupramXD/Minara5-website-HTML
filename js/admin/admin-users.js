// Studio Extrait - Admin Users & Subscribers Management Module

(function() {
  async function fetchSubscribers() {
    const tableBody = document.getElementById("subscribersTableBody");
    const feedCount = document.getElementById("subscribersFeedCount");
    if (!tableBody) return;
    
    try {
      // Self-healing automatic sync of offline subscribers
      const offlineSubs = JSON.parse(localStorage.getItem("minara_offline_subscribers") || "[]");
      if (offlineSubs.length > 0 && window.db && window.dbAddDoc && window.dbCollection) {
        let syncSuccessCount = 0;
        for (const sub of offlineSubs) {
          try {
            await window.dbAddDoc(window.dbCollection(window.db, "subscribers"), {
              email: sub.email,
              timestamp: sub.timestamp
            });
            syncSuccessCount++;
          } catch (syncErr) {
            console.warn("Failed to sync offline subscriber email:", sub.email, syncErr);
          }
        }
        if (syncSuccessCount > 0) {
          const remainingSubs = offlineSubs.slice(syncSuccessCount);
          if (remainingSubs.length === 0) {
            localStorage.removeItem("minara_offline_subscribers");
          } else {
            localStorage.setItem("minara_offline_subscribers", JSON.stringify(remainingSubs));
          }
        }
      }

      let allSubscribers = [];
      if (window.db && window.dbQuery && window.dbCollection && window.dbOrderBy && window.dbGetDocs) {
        const q = window.dbQuery(window.dbCollection(window.db, "subscribers"), window.dbOrderBy("timestamp", "desc"));
        const querySnapshot = await window.dbGetDocs(q);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          allSubscribers.push({
            id: doc.id,
            email: data.email,
            timestamp: data.timestamp,
            source: 'firestore'
          });
        });
      }

      // Fetch offline cached subscribers from localStorage
      const currentOfflineSubs = JSON.parse(localStorage.getItem("minara_offline_subscribers") || "[]");
      currentOfflineSubs.forEach((sub, index) => {
        if (!allSubscribers.some(item => (item.email || '').toLowerCase() === (sub.email || '').toLowerCase())) {
          allSubscribers.push({
            id: `local_cache_q${index}`,
            email: sub.email,
            timestamp: sub.timestamp,
            source: 'offline'
          });
        }
      });

      // Sort merged list by timestamp descending
      allSubscribers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (allSubscribers.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; opacity: 0.5; padding: 30px;">No subscribers registered yet.</td>
          </tr>
        `;
        if (feedCount) feedCount.textContent = "0 Subscribers";
        return;
      }
      
      tableBody.innerHTML = "";
      allSubscribers.forEach((sub) => {
        const date = new Date(sub.timestamp).toLocaleString();
        const isOffline = sub.source === 'offline';
        const badgeClass = isOffline ? 'pending' : 'admin';
        const badgeText = isOffline ? 'PENDING SYNC' : '5% OFF ACTIVE';
        const emailColor = isOffline ? '#ff9f0a' : 'var(--accent)';
        
        const tr = document.createElement('tr');
        
        const emailTd = document.createElement('td');
        emailTd.style.fontWeight = 'bold';
        emailTd.style.color = emailColor;
        emailTd.textContent = sub.email;
        
        if (isOffline) {
          const offlineSpan = document.createElement('span');
          offlineSpan.style.cssText = "font-size: 8px; font-weight: normal; color: #ff9f0a; border: 1px solid rgba(255, 159, 10, 0.3); padding: 1px 4px; margin-left: 5px; border-radius: 2px;";
          offlineSpan.textContent = "OFFLINE CACHE";
          emailTd.appendChild(offlineSpan);
        }
        tr.appendChild(emailTd);
        
        const dateTd = document.createElement('td');
        dateTd.textContent = date;
        tr.appendChild(dateTd);
        
        const badgeTd = document.createElement('td');
        const badgeSpan = document.createElement('span');
        badgeSpan.className = `status-badge ${badgeClass}`;
        badgeSpan.textContent = badgeText;
        badgeTd.appendChild(badgeSpan);
        tr.appendChild(badgeTd);
        
        const idTd = document.createElement('td');
        idTd.style.fontFamily = 'monospace';
        idTd.style.opacity = '0.5';
        idTd.textContent = sub.id;
        tr.appendChild(idTd);
        
        tableBody.appendChild(tr);
      });
      if (feedCount) feedCount.textContent = allSubscribers.length + " Active Subscribers";
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--danger); font-size: 11px; padding: 12px; background: rgba(255, 59, 48, 0.05);">
            ⚠ Connection Error: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  async function fetchUsers() {
    const tableBody = document.getElementById("usersTableBody");
    if (!tableBody) return;
    
    try {
      if (!window.db || !window.dbCollection || !window.dbQuery || !window.dbOrderBy || !window.dbGetDocs) return;
      const q = window.dbQuery(window.dbCollection(window.db, "users"), window.dbOrderBy("email", "asc"));
      const querySnapshot = await window.dbGetDocs(q);
      
      tableBody.innerHTML = "";
      querySnapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;
        const email = data.email || "";
        let role = data.role || "Customer";
        
        const isPrimaryOwner = email.toLowerCase() === "sub2meboyi@gmail.com";

        // SECURITY ENFORCEMENT: Only sub2meboyi@gmail.com can ever be Admin. Automatically strip unauthorized Admin status.
        if (!isPrimaryOwner && role === "Admin") {
          role = "Customer";
          try {
            if (window.dbUpdateDoc && window.dbDoc) {
              await window.dbUpdateDoc(window.dbDoc(window.db, "users", uid), { role: "Customer" });
            }
          } catch (e) {
            console.error("Auto demotion error:", e);
          }
        }
        
        const roleBadgeClass = role === "Admin" ? "admin" : "user";
        const roleBadgeText = role === "Admin" ? "ADMIN ID" : "Customer";
        
        const tr = document.createElement('tr');
        
        const emailTd = document.createElement('td');
        emailTd.style.fontWeight = 'bold';
        emailTd.style.color = role === 'Admin' ? 'var(--accent)' : 'var(--text-main)';
        emailTd.textContent = email;
        tr.appendChild(emailTd);
        
        const uidTd = document.createElement('td');
        uidTd.style.fontFamily = 'monospace';
        uidTd.style.opacity = '0.5';
        uidTd.style.fontSize = '11px';
        uidTd.textContent = uid;
        tr.appendChild(uidTd);
        
        const roleTd = document.createElement('td');
        const roleSpan = document.createElement('span');
        roleSpan.className = `status-badge ${roleBadgeClass}`;
        roleSpan.textContent = roleBadgeText;
        roleTd.appendChild(roleSpan);
        tr.appendChild(roleTd);
        
        const statusTd = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.style.color = 'var(--success)';
        statusSpan.style.fontWeight = isPrimaryOwner ? '700' : 'normal';
        statusSpan.textContent = isPrimaryOwner ? '✓ Primary Owner' : '✓ Active';
        statusTd.appendChild(statusSpan);
        tr.appendChild(statusTd);
        
        const controlTd = document.createElement('td');
        if (isPrimaryOwner) {
          const btn = document.createElement('button');
          btn.className = 'btn-action';
          btn.disabled = true;
          btn.style.opacity = '0.4';
          btn.style.cursor = 'not-allowed';
          btn.textContent = 'Superuser';
          controlTd.appendChild(btn);
        } else {
          const btn = document.createElement('button');
          btn.className = role === "Admin" ? "btn-action danger-btn" : "btn-action accent-btn";
          btn.textContent = role === "Admin" ? "Demote to User" : "Promote to Admin";
          btn.onclick = () => window.toggleUserRole(uid, role);
          controlTd.appendChild(btn);
        }
        tr.appendChild(controlTd);
        
        tableBody.appendChild(tr);
      });
      
      if (tableBody.children.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">No registered accounts found in database.</td>
          </tr>
        `;
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger); font-size: 11px; padding: 12px; background: rgba(255, 59, 48, 0.05);">
            ⚠ Connection Error: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  async function toggleUserRole(uid, currentRole) {
    if (!window.db || !window.dbDoc || !window.dbUpdateDoc) return;
    
    const newRole = currentRole === "Admin" ? "Customer" : "Admin";
    const confirmMsg = currentRole === "Admin" 
      ? "Are you sure you want to demote this user from Admin to Customer?" 
      : "Are you sure you want to promote this user to Admin?";
        
    if (!confirm(confirmMsg)) return;
    
    try {
      const userDocRef = window.dbDoc(window.db, "users", uid);
      await window.dbUpdateDoc(userDocRef, { role: newRole });
      alert(`Successfully ${currentRole === "Admin" ? 'demoted' : 'promoted'} user!`);
      if (typeof window.fetchUsers === "function") {
        window.fetchUsers();
      }
    } catch (error) {
      console.error("Error toggling user role:", error);
      alert("Failed to update user role: " + error.message);
    }
  }

  window.fetchSubscribers = fetchSubscribers;
  window.fetchUsers = fetchUsers;
  window.toggleUserRole = toggleUserRole;
})();
