# Ozow support e-mail — ready to send (drafted 5 October 2026, 17:10 SAST)

**To:** `clientsupport@ozow.com`  *(Ozow's own Client Support address — from ozow.com/contact)*
**Cc:** `info@ozow.com` (optional) · **Or call/WhatsApp:** +27 11 054 4744 / +27 67 328 6121
**Subject:** Pay by Bank broken for STU-STU-022 (500 on /api/transaction/initiate) + Merchant Details bank account can't be saved

**Attach these two files:**

1. `C:\Users\User\Pictures\Screenshots\ozow-attachments\ozow-500-system-error-2026-10-05-1659.png`
   — the error screenshot: Ozow's "System error" page with DevTools open showing `endpoint: "initiate"` and `Request failed with status code 500`.
   *(optionally also `studioextrait-checkout-error-2026-10-05-1332.png` = what our own site tells the customer)*
2. `e:\desktop\Studio Extrait website - Copy Verification\tools\OZOW-SUPPORT-REPORT.md` — the full evidence pack.

---

## Body (copy from here)

Hi Ozow team,

I run Studio Extrait — merchant `STUDIOEXTRAITPTYLTD`, site `STU-STU-022`. Since this morning **every Instant EFT / Pay by Bank checkout on my store fails**; card payments through my other provider are unaffected.

**What my customers see** (screenshot attached): your payment page opens, then shows the "System error" screen — "Unfortunately, your payment couldn't be completed." The browser console on that same page shows your page's own startup call failing:

    API ERROR: { endpoint: "initiate", error: {} }
    Uncaught (in promise) { name: "AxiosError", message: "Request failed with status code 500", code: "ERR_BAD_RESPONSE" }

So `POST https://pay.ozow.com/api/transaction/initiate` returns **HTTP 500 NullReferenceException** on every attempt. It is still failing right now — I created this one minutes ago, 5 Oct 2026 ≈17:10 SAST, and it 500s:

    https://pay.ozow.com/1d2ad4aa-9f27-47f4-9268-0e1bdc43322f/Secure
    traceId 0HNP2HKCIQ2P6:00000001

**What I think is causing it.** I went into the dashboard to check my own setup, because my first suspicion was that the problem was on my side — that my **settlement bank account** had never been saved. It hasn't: in **Merchant Details** the bank account field is empty. So I tried to save it. **The form refuses to save because it requires the Industry field — and I cannot enter anything in the Industry field at all.** It takes no typing and offers no options to select, so the Save never completes and my bank account never gets stored.

That lines up exactly with your error message: if Ozow's Pay-by-Bank session builder has to read my settlement bank account and that value is null, it would fail with precisely `Object reference not set to an instance of an object.` It also explains why the methods my account is *not* enabled for come back cleanly instead of crashing — they stop before that code runs.

Please could you:

1. **Set my industry and settlement bank account from your side** for `STUDIOEXTRAITPTYLTD` / `STU-STU-022` — **or** fix the **Industry field** in Merchant Details so it accepts input and I can save it myself; and
2. **Fix the null reference in Pay-by-Bank transaction creation** so an incomplete merchant record returns a clean "merchant details incomplete" error instead of a raw 500 on a live payment page.
3. If neither can happen quickly, please **enable Card, Capitec Pay or PayShap Request** on my account and tell me the `selectedBankId` to send. Your documentation is clear that methods other than Pay by Bank must be enabled by Ozow — so with Pay by Bank crashing I currently have **no usable Ozow method at all**, and every Instant EFT tap on my site is a dead end.
4. Please also tell me whether `"Failed to create transaction, please retry to complete your payment."` is the same incomplete-merchant-details condition.

**For your engineers** (full pack attached — `OZOW-SUPPORT-REPORT.md`):

* Every `initiate` call for this site 500s with a fresh traceId: `0HNP2HKCIQ2P6:00000001` (17:10 today), `0HNP2PIBS12BM:00000001`, `0HNP2SSPESNAP:00000001`, `0HNP2QR2BMHRI:00000001`, `0HNP2P4CSOSRS:00000001`, `0HNP2QCUKRFI8:00000001`, `0HNP2QQ1615L3:00000001` … (~23 in the report, all 5 October 2026).
* **It is not our request.** I tested the exact production payload, a minimal payload, a full payload, one without `notifyUrl`, `isTest: true`, a `requestId` that was never created, and an empty body `{}` — all 500. When our request genuinely *is* wrong your API tells us precisely ("The HashCheck value has failed"), so the 500 is not a verdict on our data.
* **It is not the bank identifier.** Naming FNB, Standard Bank or Nedbank — or sending no bank at all — 500s; naming Card / Capitec Pay / PayShap / Crypto returns **200 with a complete session payload** that quotes our own `requestId`. The payment request is read fine; only Pay-by-Bank session creation crashes.
* Your own `GetTransactionByReference` record of the real customer attempts shows `BankName`, `maskedAccountNumber` and `paymentDate` all empty — the session dies before a bank is ever reached.
* If you can give me a second site code under the same merchant, I will re-run the whole matrix against it within minutes: that separates a site-level fault from a merchant-level one.

I'm happy to run any test you need and send fresh trace IDs immediately — and I can share the full console output plus the DevTools state of the Merchant Details form (the Industry field's disabled/read-only state, which options it exposes, and where the form posts) if that helps you pinpoint it.

Thanks very much,
[YOUR NAME]
Studio Extrait (Studio Extrait Pty Ltd) · studioextrait.co.za
[YOUR PHONE / WhatsApp]

## (copy to here)

---

## How this gets sent

I have no ability to send mail myself (no mail tool, no access to your mailbox), and you should never paste a password into this chat for me. What is available **on this machine**:

* **Outlook 2016 is installed but has never been set up** — it is currently sitting on the "Welcome to Microsoft Outlook 2016" first-run dialog with **no account configured**. Until an account exists there is nothing I can drive.
* **Route A (recommended, no password shared):** complete that one-time setup yourself (add your e-mail account in the Outlook window that is already open — your password goes to Microsoft/your provider, never to me). Tell me when it's done and I will compose the message in Outlook via COM with **both attachments already on it**, then you press Send (or say "send it" and I'll call Send myself).
* **Route B (zero setup):** if your mail lives in webmail (Gmail/Outlook.com), copy the body above into a new message, and attach
  `C:\Users\User\Pictures\Screenshots\ozow-attachments\ozow-500-system-error-2026-10-05-1659.png` + `tools\OZOW-SUPPORT-REPORT.md` by hand.
* **Route C (not recommended):** SMTP credentials or an app password. Please don't — it isn't necessary for either route above, and I won't handle your passwords.

Whichever route: **always attach the PNG.** The screenshot is the one thing Ozow can read in three seconds, and it shows their own console printing the 500.
