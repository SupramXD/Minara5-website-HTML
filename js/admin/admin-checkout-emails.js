// Studio Extrait - Admin Checkout Emails Module
// The addresses captured at checkout BEFORE an order is finished (see the capture
// block at the bottom of checkout.html). One Firestore document per address - the
// document ID IS the lowercased address - so this list reads as customers rather than
// as attempts: a visitor who returns to checkout updates their one row.
// `checkout_emails` is admin-read-only in firestore.rules, so this module is the only
// place the addresses are ever read back.

(function() {
  // The rows currently on screen, so "Copy All Emails" never re-queries Firestore.
  let loadedCheckoutEmails = [];

  function railLabel(gateway) {
    if (gateway === 'yoco') return 'Card (Yoco)';
    if (gateway === 'ozow') return 'EFT (Ozow)';
    if (gateway === 'capitec') return 'Capitec Pay (Ozow)';
    return '';
  }

  async function fetchCheckoutEmails() {
    const tableBody = document.getElementById("checkoutEmailsTableBody");
    const feedCount = document.getElementById("checkoutEmailsCount");
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">Loading checkout emails from Firestore...</td>
      </tr>
    `;

    try {
      if (!window.db || !window.dbCollection || !window.dbQuery || !window.dbOrderBy || !window.dbGetDocs) {
        throw new Error("Database not initialized");
      }
      // Newest capture first: `lastSeenAt` is rewritten on every visit, so the top of
      // this list is the customer who is looking at the checkout right now.
      const q = window.dbQuery(
        window.dbCollection(window.db, "checkout_emails"),
        window.dbOrderBy("lastSeenAt", "desc")
      );
      const querySnapshot = await window.dbGetDocs(q);

      loadedCheckoutEmails = [];
      tableBody.innerHTML = "";

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const email = data.email || data.emailLower || docSnap.id;
        const lastSeen = data.lastSeenAt || data.capturedAt || "";
        const started = data.paymentStarted === true;
        loadedCheckoutEmails.push({
          email: email,
          started: started,
          lastSeen: lastSeen,
          gateway: data.paymentGateway || ""
        });

        const tr = document.createElement('tr');

        const emailTd = document.createElement('td');
        emailTd.style.color = 'var(--accent)';
        emailTd.style.fontWeight = 'bold';
        emailTd.textContent = email;
        tr.appendChild(emailTd);

        const seenTd = document.createElement('td');
        seenTd.textContent = window.formatSessionDateTime
          ? window.formatSessionDateTime(lastSeen)
          : (lastSeen || "N/A");
        tr.appendChild(seenTd);

        const statusTd = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.className = `status-badge ${started ? 'shipped' : 'pending'}`;
        statusSpan.textContent = started ? '✓ Payment started' : '⚠ Email only';
        statusTd.appendChild(statusSpan);
        tr.appendChild(statusTd);

        const railTd = document.createElement('td');
        railTd.textContent = started ? (railLabel(data.paymentGateway) || 'Selected at checkout') : '—';
        tr.appendChild(railTd);

        const idTd = document.createElement('td');
        idTd.style.fontFamily = 'monospace';
        idTd.style.fontSize = '11px';
        idTd.style.opacity = '0.5';
        idTd.textContent = docSnap.id;
        tr.appendChild(idTd);

        tableBody.appendChild(tr);
      });

      if (loadedCheckoutEmails.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; opacity: 0.5; padding: 30px;">No checkout emails captured yet.</td>
          </tr>
        `;
      }

      if (feedCount) {
        const notStarted = loadedCheckoutEmails.filter(item => !item.started).length;
        feedCount.textContent = `${loadedCheckoutEmails.length} Emails • ${notStarted} Not Started`;
      }
    } catch (error) {
      console.error("Error fetching checkout emails:", error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger); font-size: 11px; padding: 12px; background: rgba(255, 59, 48, 0.05);">
            ⚠ Connection Error: ${error.message}
          </td>
        </tr>
      `;
    }
  }

  async function copyCheckoutEmails() {
    const emails = loadedCheckoutEmails.map(item => item.email).filter(Boolean);
    if (emails.length === 0) {
      alert("Load the list first - there are no captured emails on screen to copy.");
      return;
    }

    const text = emails.join(", ");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // No Clipboard API (older browser or non-secure context): the textarea trick still copies.
        const holder = document.createElement('textarea');
        holder.value = text;
        holder.style.position = 'fixed';
        holder.style.opacity = '0';
        document.body.appendChild(holder);
        holder.select();
        document.execCommand('copy');
        document.body.removeChild(holder);
      }
      if (typeof window.logAdminSave === 'function') {
        window.logAdminSave(`${emails.length} checkout email(s) copied to the clipboard.`);
      } else {
        alert(`${emails.length} checkout email(s) copied to the clipboard.`);
      }
    } catch (error) {
      console.error("Error copying checkout emails:", error);
      // Never leave the admin without a way to get the addresses out.
      alert(text);
    }
  }

  window.fetchCheckoutEmails = fetchCheckoutEmails;
  window.copyCheckoutEmails = copyCheckoutEmails;
})();
