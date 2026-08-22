// Studio Extrait - Admin Notifications & Fragrance Requests Module

(function() {
  async function fetchUnsupportedRequests() {
    const tableBody = document.getElementById("unsupportedRequestsTableBody");
    const feedCount = document.getElementById("unsupportedRequestsCount");
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">Loading unsupported fragrance requests from Firestore...</td>
      </tr>
    `;

    try {
      if (!window.db || !window.dbCollection || !window.dbQuery || !window.dbOrderBy || !window.dbGetDocs) return;
      const q = window.dbQuery(window.dbCollection(window.db, "unsupported_requests"), window.dbOrderBy("timestamp", "desc"));
      const querySnapshot = await window.dbGetDocs(q);
      
      tableBody.innerHTML = "";
      let count = 0;
      
      querySnapshot.forEach((docSnap) => {
        count++;
        const data = docSnap.data();
        const id = docSnap.id;
        const queryText = data.query || "";
        const closestText = data.closest || "";
        const email = data.email || "";
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A";
        
        const tr = document.createElement('tr');
        
        // Requested Fragrance
        const queryTd = document.createElement('td');
        queryTd.style.fontWeight = 'bold';
        queryTd.textContent = queryText;
        tr.appendChild(queryTd);
        
        // Closest Recommendation
        const closestTd = document.createElement('td');
        closestTd.textContent = closestText;
        tr.appendChild(closestTd);
        
        // User Email
        const emailTd = document.createElement('td');
        emailTd.style.color = 'var(--accent)';
        emailTd.textContent = email;
        tr.appendChild(emailTd);
        
        // Date Submitted
        const dateTd = document.createElement('td');
        dateTd.textContent = timestamp;
        tr.appendChild(dateTd);
        
        // Firestore ID
        const idTd = document.createElement('td');
        idTd.style.fontFamily = 'monospace';
        idTd.style.opacity = '0.5';
        idTd.textContent = id;
        tr.appendChild(idTd);
        
        tableBody.appendChild(tr);
      });
      
      if (count === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">No unsupported fragrance requests registered yet.</td>
          </tr>
        `;
      }
      if (feedCount) feedCount.textContent = count + " Requests";
    } catch (error) {
      console.error("Error fetching unsupported requests:", error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger); font-size: 11px; padding: 12px; background: rgba(255, 59, 48, 0.05);">
            ⚠ Connection Error: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  async function fetchStockNotifications() {
    const tableBody = document.getElementById("stockNotificationsTableBody");
    const feedCount = document.getElementById("stockNotificationsCount");
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; opacity: 0.5; padding: 30px;">Loading out of stock notifications from Firestore...</td>
      </tr>
    `;

    try {
      if (!window.db || !window.dbCollection || !window.dbQuery || !window.dbOrderBy || !window.dbGetDocs) return;
      const q = window.dbQuery(window.dbCollection(window.db, "stock_notifications"), window.dbOrderBy("timestamp", "desc"));
      const querySnapshot = await window.dbGetDocs(q);
      
      tableBody.innerHTML = "";
      let count = 0;
      
      querySnapshot.forEach((docSnap) => {
        count++;
        const data = docSnap.data();
        const id = docSnap.id;
        const productId = data.productId || "";
        const productName = data.productName || "";
        const matchedFragrance = data.matchedFragrance || "";
        const size = data.size || "";
        const email = data.email || "";
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : "N/A";
        
        const tr = document.createElement('tr');
        
        // Product ID
        const productIdTd = document.createElement('td');
        productIdTd.style.fontFamily = 'monospace';
        productIdTd.style.fontSize = '11px';
        productIdTd.textContent = productId;
        tr.appendChild(productIdTd);
        
        // Product Name
        const productNameTd = document.createElement('td');
        productNameTd.style.fontWeight = 'bold';
        productNameTd.textContent = productName;
        tr.appendChild(productNameTd);
        
        // Matched Fragrance
        const matchedFragranceTd = document.createElement('td');
        matchedFragranceTd.style.fontWeight = 'bold';
        matchedFragranceTd.style.color = 'var(--text-muted)';
        matchedFragranceTd.textContent = matchedFragrance || productName;
        tr.appendChild(matchedFragranceTd);
        
        // Selected Size
        const sizeTd = document.createElement('td');
        sizeTd.textContent = size;
        tr.appendChild(sizeTd);
        
        // User Email
        const emailTd = document.createElement('td');
        emailTd.style.color = 'var(--accent)';
        emailTd.textContent = email;
        tr.appendChild(emailTd);
        
        // Date Submitted
        const dateTd = document.createElement('td');
        dateTd.textContent = timestamp;
        tr.appendChild(dateTd);
        
        // Firestore ID
        const idTd = document.createElement('td');
        idTd.style.fontFamily = 'monospace';
        idTd.style.opacity = '0.5';
        idTd.textContent = id;
        tr.appendChild(idTd);
        
        tableBody.appendChild(tr);
      });
      
      if (count === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; opacity: 0.5; padding: 30px;">No out of stock notifications registered yet.</td>
          </tr>
        `;
      }
      if (feedCount) feedCount.textContent = count + " Notifications";
    } catch (error) {
      console.error("Error fetching stock notifications:", error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--danger); font-size: 11px; padding: 12px; background: rgba(255, 59, 48, 0.05);">
            ⚠ Connection Error: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  window.fetchUnsupportedRequests = fetchUnsupportedRequests;
  window.fetchStockNotifications = fetchStockNotifications;
})();
